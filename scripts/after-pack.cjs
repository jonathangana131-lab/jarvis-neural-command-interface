const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const productName = context.packager.appInfo.productName;
  const version = context.packager.appInfo.version;
  const exePath = path.join(context.appOutDir, `${productName}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const rceditPath = findRcedit(context.packager.projectDir);

  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath) || !rceditPath) {
    throw new Error('Unable to stamp Windows executable metadata: missing exe, icon, or rcedit.');
  }

  execFileSync(rceditPath, [
    exePath,
    '--set-icon',
    iconPath,
    '--set-version-string',
    'FileDescription',
    productName,
    '--set-version-string',
    'ProductName',
    productName,
    '--set-version-string',
    'OriginalFilename',
    `${productName}.exe`,
    '--set-file-version',
    version,
    '--set-product-version',
    version
  ], { stdio: 'inherit' });
};

function findRcedit(projectDir) {
  const candidates = [
    path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'),
    path.join(projectDir, '.builder-tools', 'rcedit', 'rcedit-x64.exe')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}
