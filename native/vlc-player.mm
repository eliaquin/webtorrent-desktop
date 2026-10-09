// macOS video surface and libVLC 3 bridge. Only the trusted main process loads it.
// libVLC and its plugins stay in the user's VLC.app; resolve its public ABI at runtime.
#import <Cocoa/Cocoa.h>
#include <node_api.h>
#include <vlc/vlc.h>
#include <dlfcn.h>
#include <cmath>
#include <string>

#define VLC_FUNCTIONS(X) \
  X(libvlc_new) X(libvlc_release) X(libvlc_get_version) \
  X(libvlc_media_new_location) X(libvlc_media_add_option) X(libvlc_media_release) X(libvlc_media_get_stats) \
  X(libvlc_media_player_new) X(libvlc_media_player_release) X(libvlc_media_player_set_media) \
  X(libvlc_media_player_set_nsobject) X(libvlc_media_player_play) X(libvlc_media_player_stop) \
  X(libvlc_media_player_set_pause) X(libvlc_media_player_get_state) \
  X(libvlc_media_player_get_time) X(libvlc_media_player_set_time) X(libvlc_media_player_get_length) \
  X(libvlc_media_player_is_seekable) X(libvlc_media_player_set_rate) X(libvlc_media_player_get_rate) \
  X(libvlc_video_set_mouse_input) X(libvlc_video_set_key_input) X(libvlc_video_get_size) \
  X(libvlc_video_get_spu_description) X(libvlc_video_get_spu) X(libvlc_video_set_spu) \
  X(libvlc_audio_set_volume) X(libvlc_audio_get_volume) X(libvlc_audio_get_track) \
  X(libvlc_audio_set_track) X(libvlc_audio_get_track_description) \
  X(libvlc_track_description_list_release) X(libvlc_media_player_add_slave)
#define DECLARE(name) decltype(&name) name;
struct VlcAPI { VLC_FUNCTIONS(DECLARE) };
#undef DECLARE
static VlcAPI api;
static void *library = nullptr;
static std::string loadedRoot;

// Let Electron's web view handle mouse/keyboard input, including over letterboxing.
@interface WTTVideoSurface : NSView
@end
@implementation WTTVideoSurface
- (NSView *)hitTest:(NSPoint)point { return nil; }
@end

struct Player {
  libvlc_instance_t *instance = nullptr;
  libvlc_media_player_t *player = nullptr;
  libvlc_media_t *media = nullptr;
  __strong NSView *view = nil;
  napi_async_work work = nullptr;
  napi_deferred deferred = nullptr;
};
static Player *active = nullptr;
static bool closing = false;

static napi_value undefined(napi_env env) {
  napi_value value;
  napi_get_undefined(env, &value);
  return value;
}
static napi_value fail(napi_env env, const char *message) {
  napi_throw_error(env, nullptr, message);
  return nullptr;
}
static std::string stringValue(napi_env env, napi_value value) {
  size_t size = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &size) != napi_ok || size > 16384) return "";
  std::string result(size + 1, '\0');
  napi_get_value_string_utf8(env, value, result.data(), result.size(), &size);
  result.resize(size);
  return result;
}
static void numberProperty(napi_env env, napi_value object, const char *name, double number) {
  napi_value value;
  napi_create_double(env, number, &value);
  napi_set_named_property(env, object, name, value);
}
static void boolProperty(napi_env env, napi_value object, const char *name, bool flag) {
  napi_value value;
  napi_get_boolean(env, flag, &value);
  napi_set_named_property(env, object, name, value);
}
static void textProperty(napi_env env, napi_value object, const char *name, const char *text) {
  napi_value value;
  napi_create_string_utf8(env, text ? text : "", NAPI_AUTO_LENGTH, &value);
  napi_set_named_property(env, object, name, value);
}
static bool loadAPI(const std::string &root) {
  if (library) return root == loadedRoot;
  // Preload the core to resolve libVLC/plugins' @rpath dependency without changing
  // Electron's search paths or linking the addon to a machine-specific install.
  if (!dlopen((root + "/lib/libvlccore.dylib").c_str(), RTLD_NOW | RTLD_GLOBAL)) return false;
  void *handle = dlopen((root + "/lib/libvlc.dylib").c_str(), RTLD_NOW | RTLD_LOCAL);
  if (!handle) return false;
#define LOAD(name) api.name = reinterpret_cast<decltype(api.name)>(dlsym(handle, #name)); if (!api.name) return false;
  VLC_FUNCTIONS(LOAD)
#undef LOAD
  if (std::string(api.libvlc_get_version()).rfind("3.", 0) != 0) return false;
  library = handle;
  loadedRoot = root;
  return true;
}

static napi_value openPlayer(napi_env env, napi_callback_info info) {
  size_t count = 7;
  napi_value args[7];
  napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
  if (count != 7 || active || closing) return fail(env, "The native player is still closing");
  bool isBuffer = false;
  napi_is_buffer(env, args[0], &isBuffer);
  void *bytes = nullptr;
  size_t size = 0;
  if (!isBuffer || napi_get_buffer_info(env, args[0], &bytes, &size) != napi_ok || size != sizeof(void *)) return fail(env, "Invalid native window handle");
  const auto root = stringValue(env, args[1]);
  const auto url = stringValue(env, args[2]);
  double position, volume, rate;
  bool paused;
  if (root.empty() || url.empty() || napi_get_value_double(env, args[3], &position) != napi_ok ||
      napi_get_value_double(env, args[4], &volume) != napi_ok || napi_get_value_double(env, args[5], &rate) != napi_ok ||
      napi_get_value_bool(env, args[6], &paused) != napi_ok || !std::isfinite(position) || position < 0 ||
      !std::isfinite(volume) || volume < 0 || volume > 1 || !std::isfinite(rate) || rate < 0.25 || rate > 16) return fail(env, "Invalid playback settings");
  if (!loadAPI(root)) return fail(env, "Cannot load matching libVLC 3 libraries. Install VLC for this Mac's architecture.");
  setenv("VLC_PLUGIN_PATH", (root + "/plugins").c_str(), 1);
  const char *options[] = { "--no-video-title-show", "--no-osd", "--vout=macosx", "--aout=auhal", "--sub-margin=50", "--quiet" };
  auto instance = api.libvlc_new(6, options);
  if (!instance) return fail(env, "VLC could not initialize its plugins");
  auto media = api.libvlc_media_new_location(instance, url.c_str());
  auto player = api.libvlc_media_player_new(instance);
  if (!media || !player) {
    if (media) api.libvlc_media_release(media);
    if (player) api.libvlc_media_player_release(player);
    api.libvlc_release(instance);
    return fail(env, "VLC could not create a player");
  }
  NSView *host = (__bridge NSView *)*(void **)bytes;
  NSView *view = [[WTTVideoSurface alloc] initWithFrame:host.bounds];
  view.wantsLayer = YES;
  view.layer.backgroundColor = NSColor.blackColor.CGColor;
  view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  [host addSubview:view positioned:NSWindowBelow relativeTo:nil];
  active = new Player { instance, player, media, view };
  if (position > 0) api.libvlc_media_add_option(media, (":start-time=" + std::to_string(position)).c_str());
  if (paused) api.libvlc_media_add_option(media, ":start-paused");
  api.libvlc_media_player_set_media(player, media);
  api.libvlc_media_player_set_nsobject(player, (__bridge void *)view);
  api.libvlc_video_set_mouse_input(player, 0);
  api.libvlc_video_set_key_input(player, 0);
  api.libvlc_audio_set_volume(player, static_cast<int>(std::round(volume * 100)));
  api.libvlc_media_player_set_rate(player, static_cast<float>(rate));
  if (api.libvlc_media_player_play(player) != 0) return fail(env, "VLC could not start playback");
  return undefined(env);
}

// stop() may wait for Cocoa tasks on the main thread. Never block that thread.
static void stopWork(napi_env env, void *data) {
  auto context = static_cast<Player *>(data);
  api.libvlc_media_player_stop(context->player);
  api.libvlc_media_player_release(context->player);
  api.libvlc_media_release(context->media);
  api.libvlc_release(context->instance);
}
static void stopComplete(napi_env env, napi_status status, void *data) {
  auto context = static_cast<Player *>(data);
  [context->view removeFromSuperview];
  context->view = nil;
  napi_resolve_deferred(env, context->deferred, undefined(env));
  napi_delete_async_work(env, context->work);
  delete context;
  closing = false;
}
static napi_value closePlayer(napi_env env, napi_callback_info info) {
  napi_value promise;
  napi_deferred deferred;
  napi_create_promise(env, &deferred, &promise);
  if (!active) {
    napi_resolve_deferred(env, deferred, undefined(env));
    return promise;
  }
  auto context = active;
  active = nullptr;
  closing = true;
  context->deferred = deferred;
  [context->view removeFromSuperview];
  napi_value name;
  napi_create_string_utf8(env, "Close VLC player", NAPI_AUTO_LENGTH, &name);
  napi_create_async_work(env, nullptr, name, stopWork, stopComplete, context, &context->work);
  napi_queue_async_work(env, context->work);
  return promise;
}

static napi_value descriptions(napi_env env, libvlc_track_description_t *list) {
  napi_value array;
  napi_create_array(env, &array);
  uint32_t index = 0;
  for (auto item = list; item; item = item->p_next) {
    if (item->i_id < 0) continue;
    napi_value track;
    napi_create_object(env, &track);
    numberProperty(env, track, "id", item->i_id);
    textProperty(env, track, "label", item->psz_name);
    napi_set_element(env, array, index++, track);
  }
  if (list) api.libvlc_track_description_list_release(list);
  return array;
}
static napi_value snapshot(napi_env env, napi_callback_info info) {
  napi_value result;
  napi_create_object(env, &result);
  if (!active) return result;
  auto player = active->player;
  numberProperty(env, result, "state", api.libvlc_media_player_get_state(player));
  numberProperty(env, result, "currentTime", std::max<int64_t>(0, api.libvlc_media_player_get_time(player)) / 1000.0);
  numberProperty(env, result, "duration", std::max<int64_t>(0, api.libvlc_media_player_get_length(player)) / 1000.0);
  numberProperty(env, result, "volume", std::max(0, api.libvlc_audio_get_volume(player)) / 100.0);
  numberProperty(env, result, "rate", api.libvlc_media_player_get_rate(player));
  boolProperty(env, result, "seekable", api.libvlc_media_player_is_seekable(player));
  unsigned width = 0, height = 0;
  api.libvlc_video_get_size(player, 0, &width, &height);
  numberProperty(env, result, "width", width);
  numberProperty(env, result, "height", height);
  numberProperty(env, result, "audioTrack", api.libvlc_audio_get_track(player));
  numberProperty(env, result, "subtitleTrack", api.libvlc_video_get_spu(player));
  napi_set_named_property(env, result, "audioTracks", descriptions(env, api.libvlc_audio_get_track_description(player)));
  napi_set_named_property(env, result, "subtitleTracks", descriptions(env, api.libvlc_video_get_spu_description(player)));
  libvlc_media_stats_t stats {};
  if (api.libvlc_media_get_stats(active->media, &stats)) {
    numberProperty(env, result, "decodedFrames", stats.i_decoded_video);
    numberProperty(env, result, "displayedFrames", stats.i_displayed_pictures);
    numberProperty(env, result, "lostFrames", stats.i_lost_pictures);
  }
  textProperty(env, result, "version", api.libvlc_get_version());
  return result;
}

static napi_value command(napi_env env, napi_callback_info info) {
  size_t count = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
  if (!active || count < 2) return fail(env, "No active native player");
  const auto name = stringValue(env, args[0]);
  if (name == "subtitle-file") {
    const auto url = stringValue(env, args[1]);
    bool select = true;
    if (count == 3) napi_get_value_bool(env, args[2], &select);
    if (url.empty() || api.libvlc_media_player_add_slave(active->player, libvlc_media_slave_type_subtitle, url.c_str(), select) != 0) return fail(env, "VLC could not load this subtitle file");
  } else {
    double value;
    if (napi_get_value_double(env, args[1], &value) != napi_ok || !std::isfinite(value)) return fail(env, "Invalid native playback value");
    auto player = active->player;
    if (name == "pause" && (value == 0 || value == 1)) api.libvlc_media_player_set_pause(player, value == 1);
    else if (name == "seek" && value >= 0 && value <= 1e9) api.libvlc_media_player_set_time(player, static_cast<int64_t>(value * 1000));
    else if (name == "volume" && value >= 0 && value <= 1) api.libvlc_audio_set_volume(player, static_cast<int>(std::round(value * 100)));
    else if (name == "rate" && value >= 0.25 && value <= 16) {
      if (api.libvlc_media_player_set_rate(player, value) != 0) return fail(env, "VLC cannot apply this playback speed");
    } else if (name == "audio-track" && value == std::floor(value) && value >= -1 && value <= INT32_MAX) {
      if (api.libvlc_audio_set_track(player, value) != 0) return fail(env, "VLC cannot select this audio track");
    } else if (name == "subtitle-track" && value == std::floor(value) && value >= -1 && value <= INT32_MAX) {
      if (api.libvlc_video_set_spu(player, value) != 0) return fail(env, "VLC cannot select this subtitle track");
    } else return fail(env, "Unknown native playback command");
  }
  return undefined(env);
}
static napi_value bounds(napi_env env, napi_callback_info info) {
  size_t count = 4;
  napi_value args[4];
  napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
  double values[4];
  if (count != 4 || !active) return undefined(env);
  for (int i = 0; i < 4; i++) {
    if (napi_get_value_double(env, args[i], &values[i]) != napi_ok || !std::isfinite(values[i])) return fail(env, "Invalid native video bounds");
  }
  auto view = active->view;
  auto host = view.superview;
  const auto y = host.isFlipped ? values[1] : host.bounds.size.height - values[1] - values[3];
  view.frame = NSMakeRect(values[0], y, std::max(0.0, values[2]), std::max(0.0, values[3]));
  return undefined(env);
}
static napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    { "open", 0, openPlayer, 0, 0, 0, napi_default, 0 },
    { "close", 0, closePlayer, 0, 0, 0, napi_default, 0 },
    { "snapshot", 0, snapshot, 0, 0, 0, napi_default, 0 },
    { "command", 0, command, 0, 0, 0, napi_default, 0 },
    { "bounds", 0, bounds, 0, 0, 0, napi_default, 0 }
  };
  napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
