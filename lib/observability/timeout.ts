/**
 * Prazo máximo para uma promessa. PURA.
 *
 * Telemetria e sondas de saúde falam com o banco; se o banco travar, quem
 * espera por elas trava junto. Com prazo, o pior caso é custo conhecido
 * (2 s ao gravar um erro, 5 s numa sonda) em vez de "até a função serverless
 * morrer". A operação original não é cancelada (não há como cancelar um
 * `await` de rede aqui): só deixamos de esperar por ela.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} excedeu ${ms} ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(work: PromiseLike<T>, ms: number, label = "operação"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    Promise.resolve(work).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
