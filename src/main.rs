use std::ffi::CStr;
use std::io::{self, Read};
use std::os::raw::{c_char, c_int, c_void};
use std::ptr;

#[repr(C)]
struct gvplugin_library_t {
    packagename: *mut c_char,
    apis: *mut c_void,
}

extern "C" {
    fn gvContext() -> *mut c_void;
    fn gvAddLibrary(cx: *mut c_void, plugin: *const gvplugin_library_t);
    fn agseterr(level: c_int) -> c_int;
    fn agseterrf(func: extern "C" fn(*const c_char) -> c_int) -> c_int;
    fn agreadline(n: c_int);
    fn agmemread(cp: *const c_char) -> *mut c_void;
    fn agclose(graph: *mut c_void) -> c_int;
    fn gvLayout(cx: *mut c_void, graph: *mut c_void, engine: *const c_char) -> c_int;
    fn gvRenderData(
        cx: *mut c_void,
        graph: *mut c_void,
        format: *const c_char,
        result: *mut *const c_void,
        length: *mut c_int,
    ) -> c_int;
    fn gvFreeLayout(cx: *mut c_void, graph: *mut c_void) -> c_int;
    static gvplugin_core_LTX_library: gvplugin_library_t;
    static gvplugin_dot_layout_LTX_library: gvplugin_library_t;
    static AGERR: c_int;
}

extern "C" fn errorf(err: *const c_char) -> c_int {
    let err = unsafe { CStr::from_ptr(err) };
    eprint!("{}", err.to_string_lossy());
    return 0;
}

#[no_mangle]
pub extern "C" fn tmpfile() -> c_int {
    unimplemented!();
}

#[repr(C)]
pub struct jmp_buf {
    dummy: c_int,
}

#[no_mangle]
pub extern "C" fn setjmp(_env: jmp_buf) -> c_int {
    return 0;
}

#[no_mangle]
pub extern "C" fn longjmp(_env: jmp_buf, _val: c_int) {
    unimplemented!();
}

fn main() {
    let cx = unsafe { gvContext() };
    unsafe { gvAddLibrary(cx, &gvplugin_core_LTX_library as *const _) };
    unsafe { gvAddLibrary(cx, &gvplugin_dot_layout_LTX_library as *const _) };

    unsafe { agseterr(AGERR) };
    unsafe { agseterrf(errorf) };

    unsafe { agreadline(1) };

    let format = unsafe { CStr::from_bytes_with_nul_unchecked(&b"svg\0"[..]) };
    let engine = unsafe { CStr::from_bytes_with_nul_unchecked(&b"dot\0"[..]) };

    let mut src = vec![];
    io::stdin().read_to_end(&mut src).unwrap();
    src.push(0);

    let mut result = ptr::null();
    let mut length = 0;

    loop {
        let graph = unsafe { agmemread(src.as_ptr() as *const _) };
        if graph == ptr::null_mut() {
            break;
        }
        if result == ptr::null() {
            unsafe { gvLayout(cx, graph, engine.as_ptr()) };
            unsafe {
                gvRenderData(
                    cx,
                    graph,
                    format.as_ptr(),
                    &mut result as *mut _ as *mut _,
                    &mut length as *mut _,
                )
            };
            unsafe { gvFreeLayout(cx, graph) };
        }
        unsafe { agclose(graph) };
        src = vec![];
    }

    let result = unsafe { CStr::from_ptr(result) };
    println!("{}", result.to_string_lossy());
}
