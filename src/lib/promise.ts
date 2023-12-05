type BatchOptions = {
  limit: number
}

/**
 * TODO: can be faster
 */
export const batcher =
  <T extends any[], K extends keyof T, Item extends T[K]>(
    mapper: (item: Item) => Promise<void>,
    { limit = Number.MAX_VALUE }: BatchOptions
  ) =>
  async (collection: T) => {
    const errors: Error[] = []
    const pwindow: Item[] = []

    const process = async () => {
      let batch: any = []
      while (pwindow.length > 0) {
        const item = pwindow.shift()
        if (item) {
          batch.push(mapper(item))
        }
      }
      const result = await Promise.allSettled(batch)
      result.forEach(d => {
        if (d.status === 'rejected') {
          errors.push(new Error(d.reason))
        }
      })
    }

    for (let item of collection) {
      pwindow.push(item)
      if (pwindow.length >= limit) {
        await process()
      }
    }

    if (pwindow.length) {
      await process()
    }

    return errors
  }
