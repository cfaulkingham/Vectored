use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

#[cfg(target_os = "macos")]
mod macos;

#[derive(Default)]
struct DesktopState {
    pending_files: Mutex<Vec<PathBuf>>,
    ready: AtomicBool,
    allow_exit: AtomicBool,
}

fn supported_file(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).is_some_and(|e| {
        matches!(
            e.to_ascii_lowercase().as_str(),
            "vectored" | "json" | "svg" | "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp"
        )
    })
}

fn argument_paths(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .skip(1)
        .filter_map(|arg| {
            if arg.starts_with('-') || (arg.contains("://") && !arg.starts_with("file:")) {
                return None;
            }
            let path = if arg.starts_with("file:") {
                tauri::Url::parse(&arg).ok()?.to_file_path().ok()?
            } else {
                PathBuf::from(arg)
            };
            let path = if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            };
            supported_file(&path).then_some(path)
        })
        .collect()
}

fn queue_files(app: &tauri::AppHandle, paths: Vec<PathBuf>) {
    let state = app.state::<DesktopState>();
    let mut pending = state.pending_files.lock().unwrap();
    for path in paths {
        // Canonical paths bind each grant to a specific existing file, not a folder.
        if let Ok(path) = path.canonicalize() {
            if supported_file(&path)
                && path.is_file()
                && !pending.contains(&path)
                && app.fs_scope().allow_file(&path).is_ok()
            {
                pending.push(path);
            }
        }
    }
    drop(pending);
    let _ = app.emit("desktop-files-available", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn take_pending_files(state: tauri::State<DesktopState>) -> Vec<PathBuf> {
    std::mem::take(&mut *state.pending_files.lock().unwrap())
}

#[tauri::command]
fn desktop_ready(state: tauri::State<DesktopState>) {
    state.ready.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn set_document_status(window: tauri::WebviewWindow, title: String) -> tauri::Result<()> {
    window.set_title(&title)
}

#[tauri::command]
fn finish_close(app: tauri::AppHandle, state: tauri::State<DesktopState>) {
    state.allow_exit.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn request_close(app: &tauri::AppHandle) {
    let _ = app.emit("desktop-close-requested", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn install_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    let new = MenuItemBuilder::with_id("new", "New Project")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open = MenuItemBuilder::with_id("open", "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("save-as", "Save As…")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let file = SubmenuBuilder::new(app, "File")
        .items(&[&new, &open, &save, &save_as])
        .separator()
        .close_window()
        .build()?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()?;
    let menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    let menu = menu.item(
        &SubmenuBuilder::new(app, "Vectored")
            .about(None)
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?,
    );
    #[cfg(not(target_os = "macos"))]
    file.append(&tauri::menu::PredefinedMenuItem::quit(app, None)?)?;
    app.set_menu(menu.items(&[&file, &edit, &window]).build()?)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DesktopState::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            queue_files(app, argument_paths(args, Path::new(&cwd)));
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            take_pending_files,
            desktop_ready,
            set_document_status,
            finish_close
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            macos::install_quit_guard(app.handle())?;
            install_menu(app)?;
            let cwd = std::env::current_dir().unwrap_or_default();
            queue_files(app.handle(), argument_paths(std::env::args(), &cwd));
            Ok(())
        })
        .on_menu_event(|app, event| {
            if matches!(event.id().as_ref(), "new" | "open" | "save" | "save-as") {
                let _ = app.emit("desktop-file-command", event.id().as_ref());
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<DesktopState>();
                if state.ready.load(Ordering::SeqCst) && !state.allow_exit.load(Ordering::SeqCst) {
                    api.prevent_close();
                    request_close(window.app_handle());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Vectored")
        .run(|app, event| match event {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            tauri::RunEvent::Opened { urls } => {
                queue_files(
                    app,
                    urls.into_iter()
                        .filter_map(|url| url.to_file_path().ok())
                        .collect(),
                );
            }
            tauri::RunEvent::ExitRequested { api, .. } => {
                let state = app.state::<DesktopState>();
                if state.ready.load(Ordering::SeqCst) && !state.allow_exit.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    request_close(app);
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn association_arguments_handle_spaces_urls_and_skip_flags() {
        let cwd = std::env::current_dir().unwrap();
        let url_path = cwd.join("test artwork.SVG");
        let url = tauri::Url::from_file_path(&url_path).unwrap().to_string();
        let paths = argument_paths(
            vec![
                "vectored".into(),
                "--flag".into(),
                "drawing.vectored".into(),
                url,
                "https://example.com/file.svg".into(),
                "notes.txt".into(),
            ],
            &cwd,
        );
        assert_eq!(paths, vec![cwd.join("drawing.vectored"), url_path]);
    }

    #[test]
    fn associations_only_include_formats_the_editor_reads() {
        for ext in [
            "vectored", "JSON", "SVG", "png", "jpg", "jpeg", "webp", "gif", "bmp",
        ] {
            assert!(supported_file(Path::new(&format!("art.{ext}"))));
        }
        for ext in ["pdf", "dxf", "exe", "txt"] {
            assert!(!supported_file(Path::new(&format!("art.{ext}"))));
        }
    }
}
