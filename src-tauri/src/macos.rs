//! Tao 0.35 does not forward AppKit termination requests to ExitRequested.
//! Supply the missing delegate method so menu Quit, Command-Q, and Dock Quit
//! all wait for the same document guard as the window close button.
use objc2::{
    ffi::class_addMethod,
    runtime::{AnyClass, AnyObject, Imp, Sel},
    sel, Encode, MainThreadMarker,
};
use objc2_app_kit::{NSApplication, NSApplicationTerminateReply};
use std::{
    ffi::CString,
    sync::{atomic::Ordering, OnceLock},
};
use tauri::Manager;

static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

extern "C-unwind" fn should_terminate(
    _delegate: &AnyObject,
    _selector: Sel,
    _sender: &NSApplication,
) -> NSApplicationTerminateReply {
    if let Some(app) = APP.get() {
        let state = app.state::<super::DesktopState>();
        if state.ready.load(Ordering::SeqCst) && !state.allow_exit.load(Ordering::SeqCst) {
            super::request_close(app);
            return NSApplicationTerminateReply::TerminateCancel;
        }
    }
    NSApplicationTerminateReply::TerminateNow
}

pub fn install_quit_guard(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mtm = MainThreadMarker::new().ok_or("Quit guard must be installed on the main thread")?;
    let application = NSApplication::sharedApplication(mtm);
    let delegate = application
        .delegate()
        .ok_or("Missing application delegate")?;
    APP.set(app.clone())
        .map_err(|_| "Quit guard already installed")?;
    let object: &AnyObject = (*delegate).as_ref();
    let class = object.class() as *const AnyClass as *mut AnyClass;
    let encoding = CString::new(format!("{}@:@", NSApplicationTerminateReply::ENCODING))?;
    // SAFETY: this is the AppKit delegate's documented method signature. The
    // runtime copies the encoding and retains the static function pointer. We
    // only add a missing method; no delegate, ivars, or existing methods change.
    let added = unsafe {
        let implementation: Imp = std::mem::transmute(
            should_terminate
                as extern "C-unwind" fn(
                    &AnyObject,
                    Sel,
                    &NSApplication,
                ) -> NSApplicationTerminateReply,
        );
        class_addMethod(
            class,
            sel!(applicationShouldTerminate:),
            implementation,
            encoding.as_ptr(),
        )
    };
    if !added.as_bool() {
        return Err("Application delegate already implements applicationShouldTerminate; review the quit guard for this Tauri version".into());
    }
    Ok(())
}
