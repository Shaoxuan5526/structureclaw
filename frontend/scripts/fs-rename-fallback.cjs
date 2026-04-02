const fs = require('node:fs');
const fsp = require('node:fs/promises');

async function renameWithFallback(oldPath, newPath) {
  try {
    await originalRename(oldPath, newPath);
  } catch (error) {
    if (!error || error.code !== 'EXDEV') {
      throw error;
    }
    await fsp.copyFile(oldPath, newPath);
    await fsp.unlink(oldPath);
  }
}

const originalRename = fsp.rename.bind(fsp);
fsp.rename = async (oldPath, newPath) => renameWithFallback(oldPath, newPath).catch((error) => {
  // If fallback failed because target exists, use atomic overwrite sequence.
  if (error && error.code === 'EEXIST') {
    return fsp.unlink(newPath)
      .then(() => renameWithFallback(oldPath, newPath));
  }
  throw error;
});

const originalRenameCb = fs.rename.bind(fs);
fs.rename = (oldPath, newPath, callback) => {
  if (typeof callback !== 'function') {
    return originalRenameCb(oldPath, newPath, callback);
  }
  originalRenameCb(oldPath, newPath, (error) => {
    if (!error || error.code !== 'EXDEV') {
      callback(error);
      return;
    }
    fsp.copyFile(oldPath, newPath)
      .then(() => fsp.unlink(oldPath))
      .then(() => callback(null))
      .catch(callback);
  });
};
