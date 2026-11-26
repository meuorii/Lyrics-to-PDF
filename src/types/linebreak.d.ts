declare module 'linebreak' {
  export type BreakOpportunity = { position: number; required: boolean };
  export class LineBreaker {
    constructor(text: string);
    nextBreak(): BreakOpportunity | null;
  }
}
