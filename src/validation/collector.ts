import type { Severity, Violation } from './violation.ts';

/** Acumula violaciones durante la validación. */
export class Collector {
  readonly violations: Violation[] = [];

  add(
    path: string,
    rule: string,
    message: string,
    extra: { severity?: Severity; aeatCode?: number; reference?: string } = {},
  ): void {
    this.violations.push({
      path,
      rule,
      severity: extra.severity ?? 'error',
      message,
      ...(extra.aeatCode !== undefined && { aeatCode: extra.aeatCode }),
      ...(extra.reference !== undefined && { reference: extra.reference }),
    });
  }

  /** Añade la violación si `condition` es falsa. Devuelve `condition`. */
  check(
    condition: boolean,
    path: string,
    rule: string,
    message: string,
    extra?: { severity?: Severity; aeatCode?: number; reference?: string },
  ): boolean {
    if (!condition) this.add(path, rule, message, extra);
    return condition;
  }
}
