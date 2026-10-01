/** Same keys as the English source, any string values. Keeps every locale complete. */
export type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> }
