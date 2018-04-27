import path from 'path';
import url from 'url';
import {app, crashReporter, BrowserWindow, Menu} from 'electron';
import allActions from './actions';
const modal = require('electron-modal');
import configureStore from './mainStore';
import { allow2Request } from './util';
import { bindActionCreators } from 'redux';
const async = require('async');
var allow2 = require('allow2');

const isDevelopment = (process.env.NODE_ENV === 'development');

let mainWindow = null;
let forceQuit = false;

const store = configureStore();

const installExtensions = async () => {
    const installer = require('electron-devtools-installer');
    const extensions = [
        'REACT_DEVELOPER_TOOLS',
        'REDUX_DEVTOOLS'
    ];
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    for (const name of extensions) {
        try {
            await installer.default(installer[name], forceDownload);
        } catch (e) {
            console.log(`Error installing ${name} extension: ${e.message}`);
        }
    }
};

crashReporter.start({
    productName: 'Allow2Automate',
    companyName: 'Allow2',
    submitURL: 'https://staging-api.allow2.com/crashReport',
    uploadToServer: false
});

app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('ready', async () => {

    // Run this on the ready event to setup everything
    // needed on the main process.
    modal.setup();
    const actions = bindActionCreators(allActions, store.dispatch);

    var pollTimer = null;
    var usageTimer = null;

    if (isDevelopment) {
        await installExtensions();
    }

    mainWindow = new BrowserWindow({
        width: 660,
        height: 800,
        minWidth: 640,
        maxWidth: 660,
        minHeight: 480,
        show: false,
        title: 'Allow2Automate',
        icon: path.join(__dirname, 'assets/icons/png/64x64.png')
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // show window once on first load
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.show();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        // Handle window logic properly on macOS:
        // 1. App should not terminate if window has been closed
        // 2. Click on icon in dock should re-open the window
        // 3. ⌘+Q should close the window and quit the app
        if (process.platform === 'darwin') {
            mainWindow.on('close', function (e) {
                store.save();
                if (!forceQuit) {
                    e.preventDefault();
                    mainWindow.hide();
                }
            });

            app.on('activate', () => {
                mainWindow.show();
            });

            app.on('before-quit', () => {
                store.save();
                forceQuit = true;
            });
        } else {
            mainWindow.on('closed', () => {
                console.log('Persisting');
                store.save();
                mainWindow = null;
            });
        }
    });

    if (isDevelopment) {
        // auto-open dev tools
        mainWindow.webContents.openDevTools();

        // add inspect element on right click menu
        mainWindow.webContents.on('context-menu', (e, props) => {
            Menu.buildFromTemplate([{
                label: 'Inspect element',
                click() {
                    mainWindow.inspectElement(props.x, props.y);
                }
            }]).popup(mainWindow);
        });
    }

    function pollInfo() {
        let state = store.getState();
        console.log("polling info");
        if (state && state.user && state.user.access_token) {
            allow2Request('/rest/info',
                {
                    auth: {
                        bearer: state.user.access_token
                    },
                    body: {}
                },

                function (error, response, body) {
                    if (error) {
                        return dialogs.alert(error.toString());
                    }
                    if (!response) {
                        return dialogs.alert('Invalid Response');
                    }
                    if (body && body.message) {
                        return dialogs.alert(body.message);
                    }
                    return dialogs.alert('Oops');
                },

                function (data) {
                    actions.newData(data);
                });
        }
    }
    pollInfo();
    pollTimer = setInterval(pollInfo, 30000);

    function pollUsage() {
        let state = store.getState();

        let activeDevices = Object.values(state.devices).filter(function(device) {
            return device.state;
        });
        let pollDevices = activeDevices.reduce(function(memo, device) {
            let pairing = state.pairings[device.device.UDN];
            if (pairing) {
                pairing.device = device.device;
                memo.push(pairing);
            }
            return memo;
        }, []);
        async.each(pollDevices, function(device, callback) {
            console.log('poll', device);
            allow2.check({
                userId: device.controllerId,
                pairId: device.id,
                deviceToken: device.deviceToken,
                childId: device.ChildId,
                tz: 'Australia/Sydney',
                activities: [{
                    id: 7,
                    log: true
                }],
                //log: true 			// default is true,
                staging: true		// default is production
            }, function(err, result) {
                if (err) { return; }    // simple bail out if any errors occur to avoid user not being able to turn on things

                if (!result.allowed) {
                    // only need to grab the client to turn it off
                    console.log( device.device.device.friendlyName, ' not allowed ', result );
                    //device.setBinaryState(0);
                    return;
                }
                console.log(device.name, ' is on / running');
                // interpret the result and if not allowed, turn the light back off again!
            });
            callback(null);
        }, function(err) {
            console.log('poll done', err);
        });
    }
    pollUsage();
    usageTimer = setInterval(pollUsage, 10000);
});
