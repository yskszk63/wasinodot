use std::alloc;
use std::ffi::{CStr, CString, FromBytesWithNulError};
use std::fmt::Display;
use std::mem;
use std::num::NonZeroU8;
use std::os::raw::{c_char, c_int};

use sys::{agclose, agmemread, gvAddLibrary, Agraph_t};

pub mod stub {
    use std::os::raw::c_int;

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
        0
    }

    #[no_mangle]
    pub extern "C" fn longjmp(_env: jmp_buf, _val: c_int) {
        unimplemented!();
    }
}

pub(crate) mod sys {
    use std::os::raw::{c_char, c_int, c_void};

    #[repr(C)]
    pub struct gvplugin_library_t {
        packagename: *mut c_char,
        apis: *mut c_void,
    }

    #[allow(non_camel_case_types)]
    pub enum GVC_t {}

    #[allow(non_camel_case_types)]
    pub enum Agraph_t {}

    extern "C" {
        // https://graphviz.org/pdf/libguide.pdf

        pub fn gvContext() -> *mut GVC_t;
        pub fn gvFreeContext(cx: *mut GVC_t) -> c_int;
        pub fn gvAddLibrary(cx: *mut GVC_t, plugin: *const gvplugin_library_t);
        pub fn agseterr(level: c_int) -> c_int;
        pub fn agseterrf(func: extern "C" fn(*const c_char) -> c_int) -> c_int;
        pub fn agreadline(n: c_int);
        pub fn agmemread(cp: *const c_char) -> *mut Agraph_t;
        pub fn agclose(graph: *mut Agraph_t) -> c_int;
        pub fn gvLayout(cx: *mut GVC_t, graph: *mut Agraph_t, engine: *const c_char) -> c_int;
        pub fn gvRenderData(
            cx: *mut GVC_t,
            graph: *mut Agraph_t,
            format: *const c_char,
            result: *mut *const c_char,
            length: *mut c_int,
        ) -> c_int;
        pub fn gvFreeRenderData(result: *const c_char);
        pub fn gvFreeLayout(cx: *mut GVC_t, graph: *mut Agraph_t) -> c_int;
        pub static gvplugin_core_LTX_library: gvplugin_library_t;
        pub static gvplugin_dot_layout_LTX_library: gvplugin_library_t;
        pub static AGERR: c_int;
    }
}

mod imports {
    use std::os::raw::{c_char, c_int};

    extern "C" {
        pub fn handle_err(buf: *const c_char, len: c_int);
    }
}

#[no_mangle]
pub fn src_alloc(size: c_int) -> *mut u8 {
    unsafe {
        alloc::alloc(alloc::Layout::from_size_align_unchecked(
            size as usize,
            mem::align_of::<u8>(),
        ))
    }
}

#[no_mangle]
pub fn src_free(ptr: *mut u8, size: c_int) {
    unsafe {
        alloc::dealloc(
            ptr,
            alloc::Layout::from_size_align_unchecked(size as usize, mem::align_of::<u8>()),
        );
    }
}

extern "C" fn errorf(err: *const c_char) -> c_int {
    let err = unsafe { CStr::from_ptr(err) };
    let err = err.to_string_lossy();
    unsafe {
        imports::handle_err(err.as_ptr() as *const _, err.len() as c_int);
    }
    0
}

enum GraphvizPluginLibrary {
    Core,
    DotLayout,
}

impl GraphvizPluginLibrary {
    fn as_raw(&self) -> &'static sys::gvplugin_library_t {
        match self {
            Self::Core => unsafe { &sys::gvplugin_core_LTX_library },
            Self::DotLayout => unsafe { &sys::gvplugin_dot_layout_LTX_library },
        }
    }
}

#[doc(hidden)]
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("failed to read graph.")]
    Graph,
    #[error("failed to layout.")]
    Layout,
    #[error("failed to render.")]
    Render,
    #[error(transparent)]
    FromBytesWithNul(#[from] FromBytesWithNulError),
}

struct Graph {
    inner: *mut Agraph_t,
}

impl Graph {
    fn from_memory(src: &CStr) -> Result<Self, Error> {
        let graph = unsafe { agmemread(src.as_ptr() as _) };
        if graph.is_null() {
            return Err(Error::Graph);
        }
        Ok(Self { inner: graph })
    }
}

impl Drop for Graph {
    fn drop(&mut self) {
        unsafe {
            agclose(self.inner);
        }
    }
}

struct Layout<'a> {
    cx: &'a GraphvizContext,
    graph: &'a Graph,
}

impl<'a> Drop for Layout<'a> {
    fn drop(&mut self) {
        unsafe {
            sys::gvFreeLayout(self.cx.inner, self.graph.inner);
        }
    }
}

struct GraphvizContext {
    inner: *mut sys::GVC_t,
}

impl GraphvizContext {
    fn new() -> Self {
        let cx = unsafe { sys::gvContext() };
        Self { inner: cx }
    }

    fn add_library(&self, lib: &GraphvizPluginLibrary) {
        let raw = lib.as_raw();
        unsafe { gvAddLibrary(self.inner, raw) }
    }

    fn layout<'a>(&'a self, graph: &'a Graph, engine: &CStr) -> Result<Layout<'a>, Error> {
        let ret = unsafe { sys::gvLayout(self.inner, graph.inner, engine.as_ptr()) };
        if ret != 0 {
            return Err(Error::Layout);
        }
        Ok(Layout { cx: self, graph })
    }

    fn render(
        &self,
        graph: &Graph,
        format: &CStr,
        result: *mut *const c_char,
        length: *mut c_int,
    ) -> Result<(), Error> {
        let ret =
            unsafe { sys::gvRenderData(self.inner, graph.inner, format.as_ptr(), result, length) };
        if ret != 0 {
            return Err(Error::Render);
        }
        Ok(())
    }
}

impl Drop for GraphvizContext {
    fn drop(&mut self) {
        unsafe {
            sys::gvFreeContext(self.inner);
        }
    }
}

fn print_err<S: Display>(err: S) {
    const UNKNOWN: NonZeroU8 = unsafe { NonZeroU8::new_unchecked(b'?') };
    let err = err
        .to_string()
        .bytes()
        .map(|b| NonZeroU8::new(b).unwrap_or(UNKNOWN))
        .collect::<Vec<_>>();
    let err = CString::from(err);
    errorf(err.as_ptr());
}

#[doc(hidden)]
pub fn render_inernal(src: *const c_char, result: *mut *const c_char) -> Result<c_int, Error> {
    unsafe {
        sys::agseterr(sys::AGERR);
        sys::agseterrf(errorf);
        sys::agreadline(1);
    }

    let cx = GraphvizContext::new();
    cx.add_library(&GraphvizPluginLibrary::Core);
    cx.add_library(&GraphvizPluginLibrary::DotLayout);

    let src = unsafe { CStr::from_ptr(src) };

    let format = unsafe { CStr::from_bytes_with_nul_unchecked(&b"svg\0"[..]) };
    let engine = unsafe { CStr::from_bytes_with_nul_unchecked(&b"dot\0"[..]) };

    let graph = Graph::from_memory(src)?;

    let layout = cx.layout(&graph, engine)?;

    let mut length = 0;
    cx.render(&graph, format, result, &mut length as *mut _)?;

    drop(layout);

    Ok(length)
}

#[no_mangle]
pub extern "C" fn render(src: *const c_char, result: *mut *const c_char) -> c_int {
    match render_inernal(src, result) {
        Ok(len) => len,
        Err(err) => {
            print_err(err);
            -1
        }
    }
}

/// Free render result memory.
///
/// # Safety
///
/// data must render returned.
#[no_mangle]
pub unsafe extern "C" fn free_render_data(data: *const c_char) {
    sys::gvFreeRenderData(data)
}
