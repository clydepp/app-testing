import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Create the browser window with fixed dimensions
  const mainWindow = new BrowserWindow({
    width: 960,           // Fixed width matching your app
    height: 752,          // Fixed height matching your app
    resizable: false,     // Disable window resizing
    maximizable: false,   // Disable maximize button
    fullscreenable: false, // Disable fullscreen
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    // Optional: Hide menu bar
    autoHideMenuBar: true,
    // Optional: Custom title
    title: 'Mandelbrot Viewer',
    // Optional: Center window on screen
    center: true,
    // Optional: Disable window controls on macOS
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  // Also add this after creating the window to ensure title is set:
  mainWindow.setTitle('Mandelbrot Viewer');

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:3000' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});