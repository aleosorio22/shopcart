#!/usr/bin/env python3
"""Genera ShopCart.dbml y ShopCart.mmd leyendo los CREATE TABLE de scripts/002 a 004.
Uso: python3 generar_er.py"""
import re
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SCRIPTS = sorted((AQUI.parent.parent / "scripts").glob("00[234]_*.sql"))


def partir(cuerpo):
    """Separa por comas de primer nivel, respetando parentesis y cadenas."""
    partes, actual, nivel, cadena = [], "", 0, False
    for ch in cuerpo:
        if ch == "'":
            cadena = not cadena
        if not cadena:
            nivel += ch == "("
            nivel -= ch == ")"
            if ch == "," and nivel == 0:
                partes.append(actual.strip())
                actual = ""
                continue
        actual += ch
    partes.append(actual.strip())
    return [p for p in partes if p]


def lista(texto):
    return [c.strip() for c in texto.split(",")]


def leer():
    sql = "\n".join(p.read_text(encoding="utf-8") for p in SCRIPTS)
    sql = re.sub(r"--[^\n]*", "", re.sub(r"/\*.*?\*/", "", sql, flags=re.S))
    tablas, fks = {}, []
    for m in re.finditer(r"CREATE TABLE (\w+\.\w+) \(", sql):
        inicio, nivel, i = m.end(), 1, m.end()
        while nivel:
            nivel += (sql[i] == "(") - (sql[i] == ")")
            i += 1
        tabla = {"columnas": [], "pk": [], "unicas": []}
        tablas[m.group(1)] = tabla
        for item in partir(sql[inicio:i - 1]):
            if item.startswith("CONSTRAINT"):
                if x := re.search(r"PRIMARY KEY \(([^)]+)\)", item):
                    tabla["pk"] = lista(x.group(1))
                elif x := re.search(r"UNIQUE \(([^)]+)\)", item):
                    tabla["unicas"].append(lista(x.group(1)))
                elif x := re.search(r"FOREIGN KEY \(([^)]+)\) REFERENCES (\w+\.\w+)\(([^)]+)\)", item):
                    fks.append((m.group(1), lista(x.group(1)), x.group(2), lista(x.group(3))))
                continue
            x = re.match(r"(\w+)\s+(AS\b|[A-Z0-9]+(?:\([^)]*\))?)", item)
            nombre, tipo = x.group(1), x.group(2)
            tabla["columnas"].append({
                "nombre": nombre,
                "tipo": "computed" if tipo == "AS" else tipo.lower(),
                "nulo": tipo != "AS" and not re.search(r"\bNOT NULL\b", item),
                "identity": "IDENTITY" in item,
            })
            if "PRIMARY KEY" in item:
                tabla["pk"] = [nombre]
            if re.search(r"\bUNIQUE\b", item):
                tabla["unicas"].append([nombre])
            for r in re.finditer(r"REFERENCES (\w+\.\w+)\((\w+)\)", item):
                fks.append((m.group(1), [nombre], r.group(1), [r.group(2)]))
    for x in re.finditer(r"ALTER TABLE (\w+\.\w+) ADD CONSTRAINT \w+ FOREIGN KEY \((\w+)\) REFERENCES (\w+\.\w+)\((\w+)\)", sql):
        fks.append((x.group(1), [x.group(2)], x.group(3), [x.group(4)]))
    return tablas, fks


def es_uno_a_uno(tablas, fk):
    t = tablas[fk[0]]
    return fk[1] == t["pk"] or fk[1] in t["unicas"]


def q(tabla):
    return '"%s"."%s"' % tuple(tabla.split("."))


def cols(nombres):
    return ", ".join('"%s"' % n for n in nombres)


def dbml(tablas, fks):
    salida, grupos = ["// Generado por generar_er.py. No editar a mano.", ""], {}
    for nombre, t in tablas.items():
        grupos.setdefault(nombre.split(".")[0], []).append(nombre)
        salida.append("Table %s {" % q(nombre))
        for c in t["columnas"]:
            attrs = []
            if t["pk"] == [c["nombre"]]:
                attrs.append("pk")
            if c["identity"]:
                attrs.append("increment")
            if [c["nombre"]] in t["unicas"]:
                attrs.append("unique")
            if not c["nulo"] and t["pk"] != [c["nombre"]]:
                attrs.append("not null")
            tipo = '"%s"' % c["tipo"]
            salida.append('  "%s" %s%s' % (c["nombre"], tipo, " [%s]" % ", ".join(attrs) if attrs else ""))
        compuestas = [u for u in t["unicas"] if len(u) > 1]
        if len(t["pk"]) > 1 or compuestas:
            salida.append("  indexes {")
            if len(t["pk"]) > 1:
                salida.append("    (%s) [pk]" % cols(t["pk"]))
            salida.extend("    (%s) [unique]" % cols(u) for u in compuestas)
            salida.append("  }")
        salida += ["}", ""]
    for fk in fks:
        origen, destino = (fk[1], fk[3])
        o = '%s."%s"' % (q(fk[0]), origen[0]) if len(origen) == 1 else "%s.(%s)" % (q(fk[0]), cols(origen))
        d = '%s."%s"' % (q(fk[2]), destino[0]) if len(destino) == 1 else "%s.(%s)" % (q(fk[2]), cols(destino))
        salida.append("Ref: %s %s %s" % (o, "-" if es_uno_a_uno(tablas, fk) else ">", d))
    salida.append("")
    for grupo, miembros in grupos.items():
        salida.append("TableGroup %s {" % grupo)
        salida.extend("  %s" % q(m) for m in miembros)
        salida += ["}", ""]
    return "\n".join(salida)


def mermaid(tablas, fks):
    ent = lambda n: n.replace(".", "_")
    salida = ["erDiagram"]
    for nombre, t in tablas.items():
        conFk = {c for fk in fks if fk[0] == nombre for c in fk[1]}
        salida.append("  %s {" % ent(nombre))
        for c in t["columnas"]:
            marcas = []
            if c["nombre"] in t["pk"]:
                marcas.append("PK")
            if c["nombre"] in conFk:
                marcas.append("FK")
            if [c["nombre"]] in t["unicas"]:
                marcas.append("UK")
            tipo = re.sub(r"\(.*", "", c["tipo"])
            salida.append("    %s %s %s" % (tipo, c["nombre"], ", ".join(marcas))) if marcas else salida.append("    %s %s" % (tipo, c["nombre"]))
        salida.append("  }")
    for fk in fks:
        nulo = any(c["nulo"] for c in tablas[fk[0]]["columnas"] if c["nombre"] in fk[1])
        padre = "|o" if nulo else "||"
        hijo = "o|" if es_uno_a_uno(tablas, fk) else "o{"
        salida.append('  %s %s--%s %s : "%s"' % (ent(fk[2]), padre, hijo, ent(fk[0]), fk[1][0]))
    return "\n".join(salida) + "\n"


tablas, fks = leer()
(AQUI / "ShopCart.dbml").write_text(dbml(tablas, fks), encoding="utf-8")
(AQUI / "ShopCart.mmd").write_text(mermaid(tablas, fks), encoding="utf-8")
print(len(tablas), "tablas,", len(fks), "relaciones")
