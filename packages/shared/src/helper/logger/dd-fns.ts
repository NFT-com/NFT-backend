const UINT_MAX = 4294967296

// Read a buffer to unsigned integer bytes.
const readInt32 = (buffer: Uint8Array, offset: number): number => {
  return (buffer[offset + 0] * 16777216) +
    (buffer[offset + 1] << 16) +
    (buffer[offset + 2] << 8) +
    buffer[offset + 3]
}

// Convert a buffer to a numerical string.
export const toNumberString = (buffer: Uint8Array, radix?: number): string => {
  let high = readInt32(buffer, 0)
  let low = readInt32(buffer, 4)
  let str = ''

  radix = radix || 10

  do {
    const mod = (high % radix) * UINT_MAX + low

    high = Math.floor(high / radix)
    low = Math.floor(mod / radix)
    str = (mod % radix).toString(radix) + str
  } while (high || low) // continue if high or low is not 0

  return str
}

// Write unsigned integer bytes to a buffer.
const writeUInt32BE = (buffer: Uint8Array, value: number, offset: number): void => {
  buffer[3 + offset] = value & 255
  value = value >> 8
  buffer[2 + offset] = value & 255
  value = value >> 8
  buffer[1 + offset] = value & 255
  value = value >> 8
  buffer[0 + offset] = value & 255
}

// Convert a numerical string to a buffer using the specified radix.
export const fromString = (str: string, radix: number): Uint8Array => {
  const buffer = new Uint8Array(8)
  const len = str.length

  let pos = 0
  let high = 0
  let low = 0

  if (str[0] === '-') pos++

  const sign = pos

  while (pos < len) {
    const chr = parseInt(str[pos++], radix)

    if (!(chr >= 0)) break // NaN

    low = low * radix + chr
    high = high * radix + Math.floor(low / UINT_MAX)
    low %= UINT_MAX
  }

  if (sign) {
    high = ~high

    if (low) {
      low = UINT_MAX - low
    } else {
      high++
    }
  }

  writeUInt32BE(buffer, high, 0)
  writeUInt32BE(buffer, low, 4)

  return buffer
}