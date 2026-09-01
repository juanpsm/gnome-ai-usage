{
  description = "AI usage indicator for GNOME Shell and Hyprland/Quickshell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      forAllSystems = f: nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ] (system: f system);
      version = (builtins.fromJSON (builtins.readFile ./gnome-extension/metadata.json)).version;
    in {
      packages = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          tray-helper = pkgs.stdenv.mkDerivation {
            pname = "ai-usage-tray";
            version = toString version;
            src = ./hyprland/tray;
            nativeBuildInputs = with pkgs; [ cmake ninja qt6.wrapQtAppsHook ];
            buildInputs = with pkgs; [ qt6.qtbase ];
          };
        });

      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          quickshellDesktop = pkgs.makeDesktopItem {
            name = "org.quickshell";
            desktopName = "Quickshell";
            comment = "QtQuick desktop shell runtime";
            # xdg-desktop-portal resolves this entry in the portal daemon's
            # environment, where a flake-only Quickshell is not on PATH.
            exec = "${pkgs.quickshell}/bin/qs";
            terminal = false;
            noDisplay = true;
            categories = [ "Utility" ];
          };
        in {
          cli = {
            type = "app";
            program = toString (pkgs.writeShellScript "ai-usage-cli" ''
              set -eu
              export PATH=${pkgs.lib.makeBinPath [ pkgs.python3 ]}:"$PATH"
              exec ${self}/package/contents/tools/sh/ai-usage-cli "$@"
            '');
          };
          hyprland = {
            type = "app";
            program = toString (pkgs.writeShellScript "ai-usage-hyprland" ''
              set -eu
              export PATH=${pkgs.lib.makeBinPath [
                pkgs.bash
                pkgs.coreutils
                pkgs.python3
              ]}:"$PATH"
              # The repo root, not hyprland/ — Quickshell roots its QML sandbox at
              # the entry point's directory, and hyprland/ cannot reach the shared
              # JS under package/. See shell.qml.
              config=${self}/shell.qml
              desktop_dir="''${XDG_DATA_HOME:-$HOME/.local/share}/applications"
              ${pkgs.coreutils}/bin/mkdir -p "$desktop_dir"
              ${pkgs.coreutils}/bin/install -m 0644 \
                ${quickshellDesktop}/share/applications/org.quickshell.desktop \
                "$desktop_dir/org.quickshell.desktop"
              ${self.packages.${system}.tray-helper}/bin/ai-usage-tray \
                ${pkgs.quickshell}/bin/qs "$config" \
                ${self}/package/contents/tools/sh/get-ai-usage &
              tray_pid=$!
              trap 'kill "$tray_pid" 2>/dev/null || true' EXIT INT TERM
              ${pkgs.quickshell}/bin/qs -p "$config"
            '');
          };
        });

      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            name = "ai-usage-widget-dev";
            packages = with pkgs; [
              qt6.qtdeclarative
              python3
              ruff
            ];
            shellHook = ''
              echo "ai-usage-widget dev shell ready"
              echo "  make help        — list targets"
            '';
          };
        });
    };
}
