const { GObject, St, GLib, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;

let isConnected = false;

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, 'WARP Indicator');

      let extension = ExtensionUtils.getCurrentExtension();
      let iconPath = extension.dir.get_child('icons').get_child('cloudflare-symbolic.svg').get_path();

      const gicon = Gio.icon_new_for_string(iconPath);

      this._icon = new St.Icon({
        gicon: gicon,
        style_class: 'warp-disconnected',
        icon_size: 16
      });
      this.add_child(this._icon);

      this._buttonSwitchItem = new PopupMenu.PopupSwitchMenuItem('WARP', false);
      this._buttonSwitchItem.connect('toggled', () => {
        this._toggleWarpConnection();
      });
      this.menu.addMenuItem(this._buttonSwitchItem);

      this._checkConnectionStatus();
      this._updateSwitchState();
    }

    async _toggleWarpConnection() {
      if (isConnected) {
        await this._disconnectFromWarp();
      } else {
        await this._connectToWarp();
      }
    }

    async _executeCommandAsync(argv) {
      try {
        let [res, stdout, stderr] = await new Promise((resolve, reject) => {
          let proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
          });
          proc.init(null);
          proc.communicate_utf8_async(null, null, (p, res) => {
            try {
              resolve(p.communicate_utf8_finish(res));
            } catch (e) {
              reject(e);
            }
          });
        });
        return [res, stdout.trim(), stderr.trim()];
      } catch (e) {
        return [false, '', e.message];
      }
    }

    async _connectToWarp() {
      let [success, stdout, stderr] = await this._executeCommandAsync(['warp-cli', 'connect']);
      isConnected = success;
      if (success) Main.notify('Connected to WARP');
      else Main.notify(`Error connecting to WARP: ${stderr}`);
      this._updateSwitchState();
    }

    async _disconnectFromWarp() {
      let [success, stdout, stderr] = await this._executeCommandAsync(['warp-cli', 'disconnect']);
      isConnected = !success;
      if (success) Main.notify('Disconnected from WARP');
      else Main.notify(`Error disconnecting from WARP: ${stderr}`);
      this._updateSwitchState();
    }

    async _checkConnectionStatus() {
      let [success, stdout, stderr] = await this._executeCommandAsync(['warp-cli', 'status']);
      isConnected = success && stdout.includes('Connected');
      this._updateSwitchState();
    }

    _updateSwitchState() {
      this._buttonSwitchItem.setToggleState(isConnected);
      this._icon.style_class = isConnected ? 'warp-connected' : 'warp-disconnected';
    }
  }
);

class WARPExtension {
  enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea('warp-indicator', this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}

function init() {
  return new WARPExtension();
}