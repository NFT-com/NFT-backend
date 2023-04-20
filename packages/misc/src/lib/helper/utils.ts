export const getRandomFloat = (min, max, decimals): number => {
  const str = (Math.random() * (max - min) + min).toFixed(decimals)

  return parseFloat(str)
}

export const chainFromId = (chainId: string): string | undefined => {
  switch (chainId) {
    case '1':
      return 'ethereum'
    case '5':
      return 'goerli'
    case '137':
      return 'polygon'
    default:
      return undefined
  }
}
