fn main() {
  tauri_build::build();

  // tauri-build embeds the app manifest (Common Controls v6) into the app binary only. Without it
  // the IPC tests in tests/ exit with STATUS_ENTRYPOINT_NOT_FOUND on Windows.
  let target = std::env::var("TARGET").unwrap_or_default();
  if target.contains("windows") && target.contains("msvc") {
    let manifest = std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("windows-test-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}", manifest.display());
  }
}
