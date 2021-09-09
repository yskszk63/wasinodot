use core::panic;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

fn get_graphviz_dir() -> PathBuf {
    let dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let graphviz_dir = Path::new(&dir).join("graphviz-2.49.0");
    if fs::metadata(&graphviz_dir)
        .map(|m| m.is_dir())
        .unwrap_or_default()
    {
        return graphviz_dir;
    }

    let graphviz_url = "https://gitlab.com/api/v4/projects/4207231/packages/generic/graphviz-releases/2.49.0/graphviz-2.49.0.tar.xz";

    let mut curl = Command::new("curl")
        .args(["-LsSf", graphviz_url])
        .stdout(Stdio::piped())
        .spawn()
        .expect("unable to run curl");
    let mut tar = Command::new("tar")
        .args(["-Jxvf", "-", "-C"])
        .arg(Path::new(&dir).join("").as_os_str())
        .stdin(curl.stdout.take().unwrap())
        .spawn()
        .expect("failed to run tar");

    if !curl.wait().expect("failed to wait exit curl.").success() {
        panic!("failed to run curl.");
    }
    if !tar.wait().expect("failed to wait exit tar.").success() {
        panic!("failed to run tar.");
    }

    let ok = Command::new("patch")
        .arg("-u")
        .arg(graphviz_dir.join("plugin/core/gvloadimage_core.c"))
        .arg(Path::new(&dir).join("patch/gvloadimage_core.patch"))
        .status()
        .expect("unable to run patch.");
    if !ok.success() {
        panic!("failed to run patch.");
    }

    graphviz_dir
}

fn configure(graphviz_dir: &Path) -> PathBuf {
    let host = env::var("HOST").unwrap();
    let dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let build = Path::new(&dir).join("graphviz-build");
    fs::create_dir_all(&build).ok();
    if fs::metadata(build.join("Makefile"))
        .map(|m| m.is_file())
        .unwrap_or_default()
    {
        return build;
    }

    let wasi_sdk_path = env::var("WASI_SDK_PATH").ok();
    let sysroot = if let Some(wasi_sdk_path) = wasi_sdk_path {
        Path::new(&wasi_sdk_path).join("share/wasi-sysroot")
    } else {
        let wasi_sysroot =
            env::var("WASI_SYSROOT").expect("`WASI_SDK_PATH` or `WASI_SYSROOT` not set.");
        PathBuf::from(wasi_sysroot)
    };

    let ok = Command::new(graphviz_dir.join("configure"))
        .arg(format!("--host={}", host))
        .args([
            "--enable-static",
            "--disable-shared",
            "--without-sfdp",
            "--disable-ltdl",
            "--without-gts",
            "--without-gtk",
            "--without-gdk",
            "--without-gdk-pixbuf",
            "--without-poppler",
            "--without-pangocairo",
            "--without-webp",
        ])
        .arg(format!("--with-sysroot={}", sysroot.to_string_lossy()))
        .arg(format!(
            "--with-extraincludedir={}",
            Path::new(&dir).join("graphviz-stub").to_string_lossy()
        ))
        .env("CC", "clang")
        .env("LD", "wasm-ld")
        .env("CXX", "clang++")
        .env("NM", "llvm-nm")
        .env("AR", "llvm-ar")
        .env("RANLIB", "llvm-ranlib")
        .env(
            "CFLAGS",
            format!(
                "--sysroot={} -target wasm32-wasi",
                sysroot.to_string_lossy()
            ),
        )
        .env("CPPFLAGS", "-D_WASI_EMULATED_SIGNAL")
        .env("LDFLAGS", "-lwasi-emulated-signal")
        .current_dir(&build)
        .status()
        .expect("unable to run configure")
        .success();
    if !ok {
        panic!("failed to run configure");
    }

    build
}

fn make(build: &Path) {
    let ok = Command::new("make")
        .current_dir(build.join("lib"))
        .status()
        .expect("unable to run make.")
        .success();
    if !ok {
        panic!("failed to run make.")
    }

    let ok = Command::new("make")
        .current_dir(build.join("plugin"))
        .status()
        .expect("unable to run make.")
        .success();
    if !ok {
        panic!("failed to run make.")
    }
}

fn main() {
    if env::var("TARGET").unwrap() != "wasm32-wasi" {
        println!("cargo:warning=Build skip cause target ne `wasi32-wasi`.");
        return;
    }

    let graphviz_dir = get_graphviz_dir();
    let build_dir = configure(&graphviz_dir);
    make(&build_dir);

    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("plugin/core/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("plugin/dot_layout/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("lib/cdt/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("lib/cgraph/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("lib/gvc/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("lib/gvpr/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("lib/pathplan/.libs").to_string_lossy()
    );
    println!(
        "cargo:rustc-link-search={}",
        build_dir.join("lib/xdot/.libs").to_string_lossy()
    );

    println!("cargo:rustc-link-lib=gvplugin_core");
    println!("cargo:rustc-link-lib=gvplugin_dot_layout");
    println!("cargo:rustc-link-lib=cdt");
    println!("cargo:rustc-link-lib=cgraph");
    println!("cargo:rustc-link-lib=gvc");
    println!("cargo:rustc-link-lib=gvpr");
    println!("cargo:rustc-link-lib=pathplan");
    println!("cargo:rustc-link-lib=xdot");
}
