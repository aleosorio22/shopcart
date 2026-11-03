import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..');
const SCRIPTS = join(RAIZ, '..', 'database', 'scripts');

interface Firma {
  todos: Set<string>;
  obligatorios: Set<string>;
}

function firmasSql(): Map<string, Firma> {
  const firmas = new Map<string, Firma>();
  const sql = readdirSync(SCRIPTS).filter((a) => a.endsWith('.sql') && !a.startsWith('015')).map((a) => readFileSync(join(SCRIPTS, a), 'utf8')).join('\n');
  for (const m of sql.matchAll(/CREATE OR ALTER PROCEDURE ((?:Api|Job)\.SP_\w+)([\s\S]*?)\bAS\s*\n\s*BEGIN/g)) {
    const firma: Firma = { todos: new Set(), obligatorios: new Set() };
    for (const p of (m[2] ?? '').matchAll(/@(\w+)\s+[A-Z]+(?:\([^)]*\))?(\s*=\s*[^,\n]+)?/g)) {
      firma.todos.add(p[1] as string);
      if (!p[2]) firma.obligatorios.add(p[1] as string);
    }
    firmas.set(m[1] as string, firma);
  }
  return firmas;
}

function archivos(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(directorio, e.name)) : e.name.endsWith('.ts') ? [join(directorio, e.name)] : []));
}

interface Llamada {
  procedimiento: string;
  parametros: string[];
  archivo: string;
}

function llamadasCodigo(): Llamada[] {
  const llamadas: Llamada[] = [];
  for (const archivo of archivos(join(RAIZ, 'src')).filter((a) => a.endsWith('sql-repository.ts') || a.endsWith('jobs.ts') || a.endsWith('main.ts'))) {
    const codigo = readFileSync(archivo, 'utf8');
    for (const m of codigo.matchAll(/'((?:Api|Job)\.SP_\w+)'(?:,\s*\{([\s\S]*?)\}\s*\))?/g)) {
      const cuerpo = m[2] ?? '';
      const parametros = [...cuerpo.matchAll(/(\w+):\s*(?:sp\.\w+\(|\{ tipo)/g)].map((p) => p[1] as string);
      if (cuerpo.includes('...paginacion(')) parametros.push('Pagina', 'TamanoPagina');
      if (cuerpo.includes('...parametrosDueno(')) parametros.push('IDUsuario', 'HashTokenInvitado');
      llamadas.push({ procedimiento: m[1] as string, parametros, archivo });
    }
  }
  return llamadas;
}

describe('contrato entre el backend y los stored procedures', () => {
  const firmas = firmasSql();
  const llamadas = llamadasCodigo();

  it('encuentra procedimientos y llamadas', () => {
    expect(firmas.size).toBeGreaterThan(90);
    expect(llamadas.length).toBeGreaterThanOrEqual(90);
  });

  it.each(llamadas.map((l) => [l.procedimiento, l] as const))('%s coincide con su firma', (_nombre, llamada) => {
    const firma = firmas.get(llamada.procedimiento);
    expect(firma, `${llamada.procedimiento} no existe en los scripts`).toBeDefined();
    const desconocidos = llamada.parametros.filter((p) => !firma?.todos.has(p));
    const faltantes = [...(firma?.obligatorios ?? [])].filter((p) => !llamada.parametros.includes(p));
    expect({ desconocidos, faltantes }).toEqual({ desconocidos: [], faltantes: [] });
  });

  it('el codigo no contiene SQL como texto', () => {
    const conSql = archivos(join(RAIZ, 'src')).filter((a) => /\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(readFileSync(a, 'utf8')));
    expect(conSql).toEqual([]);
  });
});
