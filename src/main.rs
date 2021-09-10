use std::io::{self, Read, Write};
use std::os::raw::{c_char, c_int};
use std::ptr;
use std::slice;

use libwasinodot::{free_render_data, render_inernal};

#[no_mangle]
pub extern "C" fn handle_err(buf: *const c_char, len: c_int) {
    let buf = unsafe { slice::from_raw_parts(buf as *const _, len as usize) };
    let buf = String::from_utf8_lossy(buf);
    eprintln!("{}", buf);
}

fn main() -> anyhow::Result<()> {
    let mut src = vec![];
    io::stdin().read_to_end(&mut src).unwrap();
    src.push(0);

    let mut buf = ptr::null();
    let len = render_inernal(src.as_ptr() as _, &mut buf as _)?;
    let b = unsafe { slice::from_raw_parts(buf as *const u8, len as usize) };
    let r = io::stdout().write_all(b);
    unsafe {
        free_render_data(buf);
    }
    r?;

    Ok(())
}
