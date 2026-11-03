/* 008 - RF-01. El hash de contrasena lo genera y compara el backend; la BD no ve texto plano.
   Plantilla de escritura: XACT_ABORT, TRY/CATCH, ROLLBACK, registro y re-lanzamiento. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_RegistrarCliente
    @Correo NVARCHAR(254), @HashContrasena VARCHAR(255), @Nombres NVARCHAR(100), @Apellidos NVARCHAR(100), @Telefono VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @IDRol SMALLINT = (SELECT IDRol FROM Seguridad.Rol WHERE Codigo = 'CLIENTE'), @IDUsuario INT;
        EXEC Interno.SP_Contexto_Establecer NULL;
        INSERT Seguridad.Usuario (Correo, HashContrasena, Nombres, Apellidos, Telefono, IDRol)
        VALUES (LOWER(LTRIM(RTRIM(@Correo))), @HashContrasena, @Nombres, @Apellidos, @Telefono, @IDRol);
        SET @IDUsuario = SCOPE_IDENTITY();
        SELECT @IDUsuario AS IDUsuario, 'CLIENTE' AS Rol;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51003;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_ObtenerCredenciales @Correo NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.IDUsuario, u.Correo, u.HashContrasena, u.Activo, u.BloqueadoHasta, r.Codigo AS Rol
    FROM Seguridad.Usuario u JOIN Seguridad.Rol r ON r.IDRol = u.IDRol
    WHERE u.Correo = LOWER(LTRIM(RTRIM(@Correo)));
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_RegistrarResultadoLogin @IDUsuario INT, @Exito BIT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @Maximo INT = (SELECT CAST(Valor AS INT) FROM Config.Parametro WHERE Clave = 'LOGIN_INTENTOS_MAXIMOS'),
                @Minutos INT = (SELECT CAST(Valor AS INT) FROM Config.Parametro WHERE Clave = 'LOGIN_BLOQUEO_MINUTOS');
        IF @Exito = 1
            UPDATE Seguridad.Usuario SET IntentosFallidos = 0, BloqueadoHasta = NULL, UltimoAcceso = SYSUTCDATETIME() WHERE IDUsuario = @IDUsuario;
        ELSE
            UPDATE Seguridad.Usuario
            SET IntentosFallidos = CASE WHEN IntentosFallidos + 1 >= @Maximo THEN 0 ELSE IntentosFallidos + 1 END,
                BloqueadoHasta = CASE WHEN IntentosFallidos + 1 >= @Maximo THEN DATEADD(MINUTE, @Minutos, SYSUTCDATETIME()) ELSE BloqueadoHasta END
            WHERE IDUsuario = @IDUsuario;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_CrearTokenRefresco
    @IDUsuario INT, @HashToken BINARY(32), @ExpiraEn DATETIME2(3), @DireccionIP VARCHAR(45) = NULL, @AgenteUsuario NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        INSERT Seguridad.TokenRefresco (IDUsuario, HashToken, Familia, ExpiraEn, DireccionIP, AgenteUsuario)
        VALUES (@IDUsuario, @HashToken, NEWID(), @ExpiraEn, @DireccionIP, @AgenteUsuario);
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- Reusar un token ya rotado indica robo: se revoca la familia y ese COMMIT debe persistir.
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_RotarTokenRefresco
    @HashActual BINARY(32), @HashNuevo BINARY(32), @ExpiraEn DATETIME2(3), @DireccionIP VARCHAR(45) = NULL, @AgenteUsuario NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @ID BIGINT, @IDUsuario INT, @Familia UNIQUEIDENTIFIER, @Expira DATETIME2(3), @Rotado DATETIME2(3), @Revocado DATETIME2(3), @Ahora DATETIME2(3) = SYSUTCDATETIME();
        BEGIN TRAN;
        SELECT @ID = IDTokenRefresco, @IDUsuario = IDUsuario, @Familia = Familia, @Expira = ExpiraEn, @Rotado = RotadoEn, @Revocado = RevocadoEn
        FROM Seguridad.TokenRefresco WITH (UPDLOCK, HOLDLOCK) WHERE HashToken = @HashActual;

        IF @ID IS NULL OR @Expira <= @Ahora EXEC Interno.SP_Error_Lanzar 51004;
        IF @Rotado IS NOT NULL OR @Revocado IS NOT NULL
        BEGIN
            UPDATE Seguridad.TokenRefresco SET RevocadoEn = @Ahora WHERE Familia = @Familia AND RevocadoEn IS NULL;
            COMMIT;
            EXEC Interno.SP_Error_Lanzar 51005;
        END;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuario;

        UPDATE Seguridad.TokenRefresco SET RotadoEn = @Ahora WHERE IDTokenRefresco = @ID;
        INSERT Seguridad.TokenRefresco (IDUsuario, HashToken, Familia, ExpiraEn, DireccionIP, AgenteUsuario)
        VALUES (@IDUsuario, @HashNuevo, @Familia, @ExpiraEn, @DireccionIP, @AgenteUsuario);
        COMMIT;
        SELECT u.IDUsuario, u.Correo, r.Codigo AS Rol
        FROM Seguridad.Usuario u JOIN Seguridad.Rol r ON r.IDRol = u.IDRol WHERE u.IDUsuario = @IDUsuario;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- @HashToken NULL cierra todas las sesiones del usuario.
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_RevocarTokens @IDUsuario INT, @HashToken BINARY(32) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Seguridad.TokenRefresco SET RevocadoEn = SYSUTCDATETIME()
    WHERE IDUsuario = @IDUsuario AND RevocadoEn IS NULL AND (@HashToken IS NULL OR HashToken = @HashToken);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_ObtenerPerfil @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuario;
    SELECT u.IDUsuario, u.Correo, u.Nombres, u.Apellidos, u.Telefono, r.Codigo AS Rol
    FROM Seguridad.Usuario u JOIN Seguridad.Rol r ON r.IDRol = u.IDRol WHERE u.IDUsuario = @IDUsuario;
    SELECT p.Codigo AS Permiso
    FROM Seguridad.Usuario u JOIN Seguridad.RolPermiso rp ON rp.IDRol = u.IDRol
    JOIN Seguridad.Permiso p ON p.IDPermiso = rp.IDPermiso WHERE u.IDUsuario = @IDUsuario;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_ActualizarPerfil
    @IDUsuario INT, @Nombres NVARCHAR(100), @Apellidos NVARCHAR(100), @Telefono VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuario;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuario;
        UPDATE Seguridad.Usuario SET Nombres = @Nombres, Apellidos = @Apellidos, Telefono = @Telefono, ActualizadoEn = SYSUTCDATETIME()
        WHERE IDUsuario = @IDUsuario;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_CrearUsuarioInterno
    @IDUsuarioActor INT, @Correo NVARCHAR(254), @HashContrasena VARCHAR(255), @Nombres NVARCHAR(100), @Apellidos NVARCHAR(100), @Rol VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'USUARIOS_GESTIONAR';
        DECLARE @IDRol SMALLINT = (SELECT IDRol FROM Seguridad.Rol WHERE Codigo = @Rol);
        IF @IDRol IS NULL EXEC Interno.SP_Error_Lanzar 51006, N'Rol invalido.';
        INSERT Seguridad.Usuario (Correo, HashContrasena, Nombres, Apellidos, IDRol)
        VALUES (LOWER(LTRIM(RTRIM(@Correo))), @HashContrasena, @Nombres, @Apellidos, @IDRol);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS IDUsuario;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51003;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_ListarUsuarios
    @IDUsuarioActor INT, @Texto NVARCHAR(100) = NULL, @Rol VARCHAR(30) = NULL, @Activo BIT = NULL, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'USUARIOS_GESTIONAR';
    SELECT u.IDUsuario, u.Correo, u.Nombres, u.Apellidos, r.Codigo AS Rol, u.Activo, u.UltimoAcceso, u.CreadoEn, COUNT(*) OVER () AS TotalRegistros
    FROM Seguridad.Usuario u JOIN Seguridad.Rol r ON r.IDRol = u.IDRol
    WHERE (@Rol IS NULL OR r.Codigo = @Rol) AND (@Activo IS NULL OR u.Activo = @Activo)
      AND (@Texto IS NULL OR u.Correo LIKE N'%' + @Texto + N'%' OR u.Nombres LIKE N'%' + @Texto + N'%' OR u.Apellidos LIKE N'%' + @Texto + N'%')
    ORDER BY u.IDUsuario DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
-- Desactivar corta tambien las sesiones activas.
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_CambiarEstadoUsuario @IDUsuarioActor INT, @IDUsuario INT, @Activo BIT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'USUARIOS_GESTIONAR';
        BEGIN TRAN;
        UPDATE Seguridad.Usuario SET Activo = @Activo, ActualizadoEn = SYSUTCDATETIME() WHERE IDUsuario = @IDUsuario;
        IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        IF @Activo = 0
            UPDATE Seguridad.TokenRefresco SET RevocadoEn = SYSUTCDATETIME() WHERE IDUsuario = @IDUsuario AND RevocadoEn IS NULL;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
/* ---------- Direcciones: siempre filtradas por el dueno ---------- */
CREATE OR ALTER PROCEDURE Api.SP_Clientes_ListarDirecciones @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT d.IDDireccion, d.Alias, d.Destinatario, d.Telefono, d.Linea1, d.Linea2, d.Referencia, d.EsPredeterminada,
           d.IDMunicipio, m.Nombre AS Municipio, dp.IDDepartamento, dp.Nombre AS Departamento
    FROM Clientes.Direccion d
    JOIN Clientes.Municipio m ON m.IDMunicipio = d.IDMunicipio
    JOIN Clientes.Departamento dp ON dp.IDDepartamento = m.IDDepartamento
    WHERE d.IDUsuario = @IDUsuario AND d.Activo = 1
    ORDER BY d.EsPredeterminada DESC, d.IDDireccion DESC;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Clientes_GuardarDireccion
    @IDUsuario INT, @IDDireccion INT = NULL, @IDMunicipio INT, @Alias NVARCHAR(40), @Destinatario NVARCHAR(150), @Telefono VARCHAR(20),
    @Linea1 NVARCHAR(200), @Linea2 NVARCHAR(200) = NULL, @Referencia NVARCHAR(300) = NULL, @EsPredeterminada BIT = 0
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuario;
        BEGIN TRAN;
        IF @EsPredeterminada = 1
            UPDATE Clientes.Direccion SET EsPredeterminada = 0
            WHERE IDUsuario = @IDUsuario AND EsPredeterminada = 1 AND (@IDDireccion IS NULL OR IDDireccion <> @IDDireccion);
        IF @IDDireccion IS NULL
        BEGIN
            INSERT Clientes.Direccion (IDUsuario, IDMunicipio, Alias, Destinatario, Telefono, Linea1, Linea2, Referencia, EsPredeterminada)
            VALUES (@IDUsuario, @IDMunicipio, @Alias, @Destinatario, @Telefono, @Linea1, @Linea2, @Referencia, @EsPredeterminada);
            SET @IDDireccion = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Clientes.Direccion
            SET IDMunicipio = @IDMunicipio, Alias = @Alias, Destinatario = @Destinatario, Telefono = @Telefono,
                Linea1 = @Linea1, Linea2 = @Linea2, Referencia = @Referencia, EsPredeterminada = @EsPredeterminada
            WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activo = 1;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        COMMIT;
        SELECT @IDDireccion AS IDDireccion;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Clientes_DesactivarDireccion @IDUsuario INT, @IDDireccion INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Clientes.Direccion SET Activo = 0, EsPredeterminada = 0 WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activo = 1;
    IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Clientes_ListarMunicipios @IDDepartamento SMALLINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT d.IDDepartamento, d.Nombre AS Departamento, m.IDMunicipio, m.Nombre AS Municipio
    FROM Clientes.Departamento d JOIN Clientes.Municipio m ON m.IDDepartamento = d.IDDepartamento
    WHERE @IDDepartamento IS NULL OR d.IDDepartamento = @IDDepartamento
    ORDER BY d.Nombre, m.Nombre;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Clientes_GuardarDatoFiscal @IDUsuario INT, @NIT VARCHAR(15), @NombreFiscal NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRAN;
        UPDATE Clientes.DatoFiscal WITH (UPDLOCK, HOLDLOCK) SET NombreFiscal = @NombreFiscal, Activo = 1 WHERE IDUsuario = @IDUsuario AND NIT = @NIT;
        IF @@ROWCOUNT = 0 INSERT Clientes.DatoFiscal (IDUsuario, NIT, NombreFiscal) VALUES (@IDUsuario, @NIT, @NombreFiscal);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Clientes_ListarDatosFiscales @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDDatoFiscal, NIT, NombreFiscal FROM Clientes.DatoFiscal WHERE IDUsuario = @IDUsuario AND Activo = 1 ORDER BY IDDatoFiscal DESC;
END;
GO
