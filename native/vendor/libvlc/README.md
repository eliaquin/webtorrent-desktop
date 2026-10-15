# libVLC build headers

These unmodified public headers come from VideoLAN VLC's `3.0.21` tag:
https://github.com/videolan/vlc/tree/3.0.21/include/vlc

Only the four headers required by `native/vlc-player.mm` are included. Their
copyright notices are preserved; see `COPYING.LIB` for LGPL 2.1 terms.

The macOS bridge builds against these pinned declarations even when VLC is not
installed on the build machine. It does not link to or bundle libVLC, plugins,
or VLC.app. At playback time it resolves the libVLC 3 API from the user's VLC
installation. Keep these headers on the VLC 3 ABI until the runtime loader is
updated to support a different major version.
