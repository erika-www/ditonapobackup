"""Lightweight monitor display (pygame, software-rendered, ~5 fps, redraws only when something changed).

Design goals: pure black background, crisp native-resolution text, and the requested yellow,
green and red palette. No flashing, blinking, scrolling or animation.
Runs on the main thread; reads DisplayState that the audio manager keeps in sync with speech."""
import os
import time
import pygame

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]

THEMES = {
    "dark": dict(bg=(0, 0, 0), fg=(242, 242, 242), yellow=(255, 176, 0), red=(255, 0, 0),
                 dim=(125, 125, 125), off=(72, 72, 72),
                 ok=(44, 211, 229), bad=(255, 0, 0),
                 approaching=(44, 211, 229), here=(44, 211, 229), next=(44, 211, 229),
                 reminder=(255, 176, 0), idle=(44, 211, 229)),
}
LABEL = {"approaching": "APPROACHING STOP / PAPARATING",
         "here": "CURRENT STOP",
         "next": "NEXT STOP",
         "reminder": "REMINDER / PAALALA"}
SCALES = (1.0, 0.9, 0.8, 0.7, 0.6, 0.5)      # text shrinks step by step until it fits


def wrap(text, font, max_w):
    lines, cur = [], ""
    for word in text.split():
        test = (cur + " " + word).strip()
        if font.size(test)[0] <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [""]


def _windows_dpi_aware():
    """On Windows with display scaling (125%/150%) the window can look cropped; ask for true pixels."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


class Screen:
    def __init__(self, cfg):
        _windows_dpi_aware()
        pygame.display.init()
        pygame.font.init()
        self.cfg = cfg
        self.fullscreen = cfg.get("fullscreen", True)
        flags = pygame.FULLSCREEN if self.fullscreen else pygame.RESIZABLE
        if self.fullscreen:
            modes = pygame.display.get_desktop_sizes()
            info = pygame.display.Info()
            size = modes[0] if modes else (info.current_w, info.current_h)
        else:
            size = (cfg.get("width", 800), cfg.get("height", 480))
        self.surf = pygame.display.set_mode(size, flags)
        self.w, self.h = self.surf.get_size()
        pygame.mouse.set_visible(False)
        pygame.display.set_caption("Bus display")
        self.fps = cfg.get("fps", 5)
        self.u = self.h / 100.0
        self.font_path = next((p for p in FONT_CANDIDATES if os.path.isfile(p)), None)
        self._fonts = {}
        self.sizes = {"small": 4.8, "mid": 6.6, "big": 11.0}      # in units of 1% of screen height

    # ---- helpers ----------------------------------------------------------
    def font(self, role, scale=1.0):
        px = max(10, int(self.u * self.sizes[role] * scale))
        if px not in self._fonts:
            self._fonts[px] = pygame.font.Font(self.font_path, px)
        return self._fonts[px]

    def theme_name(self):
        return "dark"

    @staticmethod
    def clock_text():
        return time.strftime("%B %d, %Y | %I:%M %p").replace(" 0", " ").lstrip("0")

    def _layout(self, spec, max_w, avail_h):
        """spec = [(role, color_key, [text pieces] or text, marker)] -> lines that fit in avail_h."""
        built = []
        for scale in SCALES:
            built, total = [], 0
            for role, ckey, text, marker in spec:
                f = self.font(role, scale)
                lines = wrap(text, f, max_w)
                lh = int(f.get_linesize() * 1.08)
                built.append((f, ckey, lines, lh, marker))
                total += lh * len(lines)
            total += self.u * 1.6 * (len(built) - 1)
            if total <= avail_h:
                break
        return built, total

    # ---- drawing ----------------------------------------------------------
    def draw(self, s, theme=None):
        T = THEMES[theme or self.theme_name()]
        u, w, h, surf = self.u, self.w, self.h, self.surf
        surf.fill(T["bg"])
        banner = s.get("banner")
        kind = banner["kind"] if banner else "idle"
        accent = T[kind]
        f_small = self.font("small")

        # Header: route, centered time/date, and GPS status.
        route = s.get("trip_label") or "No trip / Walang biyahe"
        route_font = self.font("small", 0.82)
        route_max = w * 0.34
        while len(route) > 4 and route_font.size(route)[0] > route_max:
            route = route[:-2]
        surf.blit(route_font.render(route, True, T["fg"]), (w * 0.027, h * 0.025))

        time_font = self.font("mid", 0.82)
        date_font = self.font("small", 0.78)
        clock = time.strftime("%I:%M %p").lstrip("0")
        date = time.strftime("%B %d, %Y").replace(" 0", " ")
        time_surf = time_font.render(clock, True, T["fg"])
        date_surf = date_font.render(date, True, T["dim"])
        separator = self.font("small", 0.75).size("  ")[0]
        pair_w = time_surf.get_width() + separator + date_surf.get_width()
        pair_x = (w - pair_w) / 2
        surf.blit(time_surf, (pair_x, h * 0.02))
        surf.blit(date_surf, (pair_x + time_surf.get_width() + separator,
                              h * 0.032))

        fix = s["gps"]["fix"]
        gps_text = f_small.render("GPS" if fix else "No GPS", True, T["fg"])
        gps_x = w - w * 0.027 - gps_text.get_width()
        gps_y = h * 0.032
        surf.blit(gps_text, (gps_x, gps_y))
        dot_color = T["ok"] if fix else T["bad"]
        pygame.draw.circle(surf, dot_color, (int(gps_x - h * 0.025), int(gps_y + gps_text.get_height() / 2)),
                           max(3, int(h * 0.009)))
        divider_y = int(h * 0.10)
        pygame.draw.line(surf, T["off"], (w * 0.027, divider_y), (w * 0.973, divider_y), max(1, int(h * 0.002)))

        stops_l = s.get("stops") or []
        idx = s.get("idx", 0)
        current_idx = s.get("current_idx")
        if current_idx is None and not s.get("active") and s.get("trip") and stops_l:
            current_idx = idx
        # Tie both visible stop labels to the last current-stop announcement
        # that has started, not to a GPS target that may already be ahead.
        next_idx = current_idx + 1 if current_idx is not None else idx
        current_name = stops_l[current_idx] if current_idx is not None and 0 <= current_idx < len(stops_l) else "—"
        next_name = stops_l[next_idx] if 0 <= next_idx < len(stops_l) else "End of route / Dulo ng ruta"

        reminder = banner and banner.get("kind") == "reminder"
        panel_left = w * 0.06
        panel_top = h * 0.13
        panel_bottom = h * 0.95
        if reminder:
            pygame.draw.rect(surf, T["reminder"], (w * 0.02, panel_top, h * 0.012, panel_bottom - panel_top))
            sp = banner.get("speaking")
            spec = [("small", "dim", LABEL["reminder"], False),
                    ("mid", "fg" if sp == "en" else "dim", banner["en"], sp == "en"),
                    ("mid", "fg" if sp == "tl" else "dim", banner["tl"], sp == "tl")]
            built, total = self._layout(spec, w * 0.86, panel_bottom - panel_top)
            y = panel_top + max(0, (panel_bottom - panel_top - total) / 2)
            for font, color, lines, line_h, marker in built:
                for line in lines:
                    surf.blit(font.render(line, True, T[color]), (panel_left, y))
                    y += line_h
                y += h * 0.012
        elif stops_l and (s.get("active") or banner or s.get("trip")):
            # Keep the last reached stop prominent; approaching is announced by audio only.
            pygame.draw.rect(surf, T["next"], (w * 0.02, panel_top, h * 0.012, panel_bottom - panel_top))
            current_title = self.font("mid", 0.82).render(
                "CURRENT STOP", True, T["next"])
            surf.blit(current_title, (panel_left, h * 0.15))

            name_scale = 1.55
            name_font = self.font("big", name_scale)
            lines = wrap(current_name, name_font, w * 0.90)
            while (len(lines) * name_font.get_linesize() > h * 0.36
                   or max(name_font.size(line)[0] for line in lines) > w * 0.90):
                name_scale = max(0.55, name_scale - 0.08)
                name_font = self.font("big", name_scale)
                lines = wrap(current_name, name_font, w * 0.90)
                if name_scale <= 0.55:
                    break
            y = h * 0.295
            for line in lines:
                surf.blit(name_font.render(line, True, T["yellow"]), (panel_left, y))
                y += name_font.get_linesize() * 1.02

            divider_y = int(h * 0.69)
            pygame.draw.line(surf, T["off"], (panel_left, divider_y), (w * 0.98, divider_y), max(1, int(h * 0.002)))
            next_title = self.font("small", 0.88).render("NEXT STOP", True, T["dim"])
            surf.blit(next_title, (panel_left, h * 0.72))
            next_scale = 1.08
            next_font = self.font("mid", next_scale)
            next_lines = wrap(next_name, next_font, w * 0.90)
            while len(next_lines) * next_font.get_linesize() > h * 0.18:
                next_scale = max(0.52, next_scale - 0.08)
                next_font = self.font("mid", next_scale)
                next_lines = wrap(next_name, next_font, w * 0.90)
                if next_scale <= 0.52:
                    break
            y = h * 0.78
            for line in next_lines:
                surf.blit(next_font.render(line, True, T["next"]), (panel_left, y))
                y += next_font.get_linesize() * 1.02

            n = len(stops_l)
            spacing = min(h * 0.11, (w * 0.78) / max(1, n - 1))
            x0, progress_y = w * 0.03, h * 0.985
            pygame.draw.line(surf, T["off"], (x0, progress_y),
                             (x0 + spacing * (n - 1), progress_y), max(2, int(h * 0.004)))
            for i in range(n):
                x = int(x0 + i * spacing)
                if i == current_idx:
                    pygame.draw.circle(surf, T["yellow"], (x, int(progress_y)), int(h * 0.021))
                elif i == next_idx:
                    pygame.draw.circle(surf, T["ok"], (x, int(progress_y)), int(h * 0.022), max(2, int(h * 0.004)))
                else:
                    color = T["dim"] if current_idx is not None and i < current_idx else T["off"]
                    pygame.draw.circle(surf, color, (x, int(progress_y)), int(h * 0.010), max(1, int(h * 0.002)))
            count = max(0, min(n, current_idx + 1)) if current_idx is not None else 0
            count_text = self.font("mid", 0.82).render(f"{count} / {n}", True, T["next"])
            surf.blit(count_text, (w * 0.85, progress_y - count_text.get_height() / 2))
            stops_label = f_small.render("stops", True, T["dim"])
            surf.blit(stops_label, (w * 0.85 + count_text.get_width() + w * 0.008,
                                    progress_y - stops_label.get_height() / 2))
        elif s.get("trip"):
            msg = self.font("big").render("End of trip / Tapos na ang biyahe", True, T["fg"])
            surf.blit(msg, msg.get_rect(center=(w / 2, h / 2)))
        else:
            msg = self.font("big").render("No trip selected / Walang napiling biyahe", True, T["fg"])
            surf.blit(msg, msg.get_rect(center=(w / 2, h / 2)))

    def run(self, display):
        clock = pygame.time.Clock()
        last_key = None
        while True:
            for e in pygame.event.get():
                if e.type == pygame.QUIT or (e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE):
                    return
                if e.type == pygame.VIDEORESIZE and not self.fullscreen:
                    self.surf = pygame.display.set_mode(e.size, pygame.RESIZABLE)
                    self.w, self.h = self.surf.get_size()
                    self.u = self.h / 100.0
                    last_key = None
            s = display.snapshot()
            theme = self.theme_name()
            # redraw only when something visible changed (saves CPU on the Pi 3B)
            key = repr((s["banner"], s["trip_label"], s["active"], s["idx"], s["phase"], s["trip"],
                        len(s["stops"]), s["gps"]["fix"], self.clock_text(), theme))
            if key != last_key:
                self.draw(s, theme)
                pygame.display.flip()
                last_key = key
            clock.tick(self.fps)
