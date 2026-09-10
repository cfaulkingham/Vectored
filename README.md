![Vectored — vector drawing and fabrication patterns](docs/assets/vectored-banner.png)

# Vectored

A vector drawing and fabrication pattern editor built with React, Vite, and Tauri 2. The desktop app bundles the editor into a native window; it does not need a browser, Node.js, or a running web server after installation.

## Development

Install Node.js 22 LTS or newer, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system:

- macOS: Xcode command line tools (`xcode-select --install`).
- Windows: Visual Studio C++ Build Tools and Microsoft Edge WebView2.
- Linux: WebKitGTK 4.1 and the distribution's development libraries listed in the Tauri guide.

```sh
npm ci
npm run desktop:dev
```

Tauri starts Vite on `127.0.0.1:3000` and opens the native app. That port must be available. Frontend edits reload automatically; Rust edits rebuild the shell.

To run only the web editor:

```sh
npm run dev
```

## Build installers

```sh
npm run desktop:build
```

The output is under `src-tauri/target/release/bundle/`:

| Build host | Outputs |
| --- | --- |
| macOS | `.app` and `.dmg` |
| Windows | MSI and NSIS installers |
| Linux | Debian, RPM, and AppImage packages |

Build each operating system's installers on that operating system. For a macOS app bundle without a disk image, use `npm run desktop:build -- --bundles app`. For a universal Mac build, install both Rust Mac targets and run:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run desktop:build -- --target universal-apple-darwin
```

The **Desktop builds** GitHub Actions workflow runs checks and produces versioned installer artifacts for Apple Silicon, Intel Mac, Windows x64, and Linux x64. It runs on pull requests, manually from Actions, and when a version tag is pushed. Mac builds use ad-hoc signing; configure [macOS signing/notarization](https://v2.tauri.app/distribute/sign/macos/) and [Windows signing](https://v2.tauri.app/distribute/sign/windows/) for trusted public installers.

## Release builds

For a full local build of your computer's platform, including checks and versioned artifacts:

```sh
npm ci
npm run release:local
```

Outputs are collected in `release/v0.1.0/<target>/`. Each filename includes the version and Rust target, and each target includes SHA-256 checksums, the MIT license, and a JSON manifest with the source commit and whether the working tree had changes. Mac releases include both a DMG and a ZIP of the app. An optional target can be passed, for example `npm run release:local -- x86_64-apple-darwin` after installing that Rust target on a Mac. Windows and Linux installers require their respective build hosts.

For all platforms, run **Desktop builds** from GitHub Actions. Enable **Create the version tag and draft release after all builds pass** to have CI tag the built commit and attach every artifact automatically. Leave it disabled for a build without a release.

You can also trigger a release by tagging a commit yourself:

```sh
git tag -a v0.1.0 -m "Vectored v0.1.0"
git push origin v0.1.0
```

Tag pushes build all four targets and create a **draft GitHub release** only after every build succeeds. The workflow verifies checksums and source commits before attaching all artifacts. Review the draft in GitHub Releases and publish it when ready. Re-running a tagged build can update its draft, but cannot replace artifacts on a published release.

For later releases, update the versions in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json` before creating the next tag. The workflow rejects a tag that disagrees with the application version. Keep released tags fixed to their original commits.

## Desktop behavior

- Save editable **`.vectored`** projects with native Save and Save As dialogs. The format is versioned JSON and stores layers, canvas settings, guides, and units. Existing `.json` projects still open; their first save offers a `.vectored` copy.
- Save writes back to the current project path. Save As creates a separate copy. The document name and an unsaved dot appear in the toolbar and window title. Undo back to the saved contents clears the dot.
- New, Open (when replacing a project), Close, and Quit offer **Save / Don't Save / Cancel** when work is unsaved. Canceling the save dialog or a failed write keeps the current document. Browser tabs also warn before reload or close.
- Installed builds register `.vectored` and offer **Open With Vectored** for SVG, PNG, JPEG, WebP, GIF, and BMP. Artwork opens through the import dialog into the current document. PDF and DXF remain export-only. General `.json` files are not associated with Vectored.
- Files opened from Finder, Explorer, a Linux file manager, or command-line arguments reach the existing window, including files received during startup. Additional files wait while an import or document dialog is open.
- Use the native File menu or Ctrl on Windows/Linux and Command on macOS with N/O/S for New/Open/Save. Shift+Ctrl/Command+S is Save As; E/I open Export/Import SVG. Existing editing shortcuts remain available.
- Save SVG, PNG, PDF, and DXF exports to a chosen location.
- Image/SVG inputs and canvas file drops use the webview's file handling. Tauri's separate drag-and-drop interception is disabled to preserve the editor's existing drop handlers.
- Styles, D3, worker scripts, and the Inter/JetBrains Mono interface fonts are bundled locally. Drawing, patterns, project files, and exports work offline with local assets and system fonts. Optional Google Fonts in artwork and remotely linked images still require internet access; unavailable fonts fall back to installed fonts. Imported embedded fonts/images remain part of the project.

File associations take effect when the built app is installed; `desktop:dev` does not install them. Linux packages include a shared MIME definition for `.vectored`; AppImage users also need their desktop's AppImage integration. Operating-system default-app preferences still apply.

Native filesystem access is limited to files selected in Open/Save dialogs or explicitly delivered to the app by the operating system. The app does not grant general home-directory or shell access. The browser build continues to use ordinary downloads.

The macOS shell adds AppKit's `applicationShouldTerminate:` delegate method because the bundled Tao version does not forward menu and Dock termination requests through Tauri's exit event ([upstream issue](https://github.com/tauri-apps/tauri/issues/12978)). Review this small adapter when upgrading Tauri/Tao.

The bundle uses Paper.js Core for geometry; the unused PaperScript compiler is excluded so production can keep a Content Security Policy that disallows dynamic code evaluation. The development policy permits Vite's inline React refresh preamble.

## Checks

```sh
npm run lint
npm test
npm run build
npm run desktop:check
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Use `package-lock.json` and `src-tauri/Cargo.lock` for reproducible builds. The older `bun.lock` predates the desktop setup; npm is the documented package manager. The frontend includes tests for document checkpoints, undo after saving, unsaved-work guards, concurrent saves, queued native opens, legacy project migration, binary exports, path handling, browser downloads, and geometry operations. Rust tests check native file argument routing.

The Tauri setup follows its [Vite integration](https://v2.tauri.app/start/frontend/vite/), [dialog](https://v2.tauri.app/plugin/dialog/), and [filesystem](https://v2.tauri.app/plugin/file-system/) guides.

## Desktop smoke checks

On a built, installed app:

1. Open a legacy JSON project, save it as `.vectored`, edit, then Save again. Verify the same file changes without a second path dialog.
2. Edit and try New, Open another project, the close button, and Quit. Verify Cancel preserves the document, Save waits for a successful write, and Don't Save continues. On macOS test both Command-Q and Dock Quit.
3. Cancel Save As and simulate a failed write (an unwritable location). The old file path and unsaved marker must remain.
4. Undo to the saved contents and verify the unsaved marker clears. Change units and verify it returns.
5. Open `.vectored` from the OS with the app closed and already running. Try paths with spaces and non-ASCII characters. Repeat with SVG and an image, including multiple files while an import dialog is open.
6. In the web build, verify `.vectored` downloads, legacy project opens, and the browser reload warning.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Colin Faulkingham.
