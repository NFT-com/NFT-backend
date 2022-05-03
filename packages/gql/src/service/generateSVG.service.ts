import { RubikBase64 } from './rubik.base64'
import { RubikBlackBase64 } from './rubikBlack.base64'

export const generateSVG = (
  profileURL: string,
  defaultImagePath: string,
): string => {
  return `<svg width="480" height="480"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face{
        font-family:"Rubik";
        src: url(data:application/font-ttf;charset=utf-8;base64,${RubikBase64}) format('truetype');
      }
      @font-face{
        font-family:"Rubik-Black";
        src: url(data:application/font-ttf;charset=utf-8;base64,${RubikBlackBase64}) format('truetype');
      }
    </style>
  </defs>
  <image href="${defaultImagePath}" height="480" width="480"/>
  <text style="letter-spacing: 3px;" font-family="Rubik" x="50%" y="380" font-size="20"  text-anchor="middle" fill="#ccc">NFT.COM/</text>
  <text font-family="Rubik-Black" x="50%" y="420" font-size="30"  text-anchor="middle" fill="white">${profileURL}</text>
</svg>`
}
