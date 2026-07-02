import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const ICON_SOURCE = './src/assets/images/app_icon_1782070894304.jpg';
const SPLASH_SOURCE = './src/assets/images/splash_screen_1781726513948.jpg';
const RES_DIR = './android/app/src/main/res';

const iconSizes = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 }
];

async function generate() {
  console.log('--- Starting Android Asset Generation ---');

  // Verify sources exist
  if (!fs.existsSync(ICON_SOURCE)) {
    console.error(`Master icon source not found at: ${ICON_SOURCE}`);
    process.exit(1);
  }

  // Load master icon
  const icon = await Jimp.read(ICON_SOURCE);
  const width = icon.width;
  const height = icon.height;
  console.log(`Loaded master icon: ${ICON_SOURCE} (${width}x${height})`);

  // Generate mipmaps
  for (const { name, size } of iconSizes) {
    const dirPath = path.join(RES_DIR, name);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Resize normal launcher icon
    const resizedIcon = icon.clone().resize({ w: size, h: size });
    const iconPath = path.join(dirPath, 'ic_launcher.png');
    await resizedIcon.write(iconPath);
    console.log(`Generated normal icon: ${iconPath} (${size}x${size})`);

    // Generate rounded launcher icon
    const roundedIcon = icon.clone().resize({ w: size, h: size });
    if (typeof roundedIcon.circle === 'function') {
      try {
        roundedIcon.circle();
      } catch (ce) {
        // Fallback or ignore
      }
    }
    const roundPath = path.join(dirPath, 'ic_launcher_round.png');
    await roundedIcon.write(roundPath);
    console.log(`Generated round icon: ${roundPath} (${size}x${size})`);
  }

  // Generate splash screen drawable if splash exists
  if (fs.existsSync(SPLASH_SOURCE)) {
    const splash = await Jimp.read(SPLASH_SOURCE);
    const drawableDir = path.join(RES_DIR, 'drawable');
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }
    const splashPath = path.join(drawableDir, 'splash.png');
    await splash.write(splashPath);
    console.log(`Generated splash drawable: ${splashPath}`);
  }

  console.log('--- Android Asset Generation Completed Successfully! ---');
}

generate().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
