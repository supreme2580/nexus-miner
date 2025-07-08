declare module 'node-pty' {
  import { EventEmitter } from 'events';

  export interface IPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: { [key: string]: string | undefined };
    handleFlowControlPause?: boolean;
    handleFlowControlResume?: boolean;
  }

  export interface IPtyExitEvent {
    exitCode: number;
    signal?: number;
  }

  export class Terminal extends EventEmitter {
    constructor();
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    onData(listener: (data: string) => void): this;
    onExit(listener: (event: IPtyExitEvent) => void): this;
  }

  export function spawn(
    file: string,
    args: string[],
    options: IPtyForkOptions
  ): Terminal;
} 