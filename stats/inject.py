#!/usr/bin/env python3
"""Put the play-statistics block (pipe-rush-stats.js) into the game's index.html.

Run it again after every new build of index.html, because a fresh build does not contain the block:

    python3 stats/inject.py                      # uses ../index.html
    python3 stats/inject.py --url https://script.google.com/macros/s/.../exec

--url also saves the web app address into pipe-rush-stats.js, so later runs keep it.
The block goes inside the game's main script, just before `window.__pb = {`. An older copy of the block is replaced.
"""
import argparse, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
START, END, ANCHOR = '/* ==== Pipe Rush play statistics', '/* ==== end of play statistics ==== */\n', 'window.__pb = {'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', default=str(HERE.parent / 'index.html'))
    ap.add_argument('--url', help='the Apps Script web app address (ends in /exec)')
    a = ap.parse_args()
    mod_path = HERE / 'pipe-rush-stats.js'
    mod = mod_path.read_text(encoding='utf-8')
    if a.url is not None:
        if a.url and not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', a.url):
            sys.exit('That does not look like an Apps Script web app address (https://script.google.com/macros/s/.../exec).')
        mod, n = re.subn(r"const STATS_URL = '[^']*';", "const STATS_URL = '%s';" % a.url, mod, count=1)
        if n != 1: sys.exit('STATS_URL line not found in pipe-rush-stats.js')
        mod_path.write_text(mod, encoding='utf-8')
    html_path = pathlib.Path(a.html)
    html = html_path.read_text(encoding='utf-8')
    i = html.find(START)
    if i >= 0:
        j = html.find(END, i)
        if j < 0: sys.exit('Found the start of an old statistics block but not its end.')
        html = html[:i] + html[j + len(END):]
    if html.count(ANCHOR) != 1:
        sys.exit('Expected exactly one "%s" in %s, found %d. The build has changed; check where the block should go.' % (ANCHOR, html_path.name, html.count(ANCHOR)))
    k = html.index(ANCHOR)
    html = html[:k] + mod + html[k:]
    html_path.write_text(html, encoding='utf-8')
    url = re.search(r"const STATS_URL = '([^']*)';", mod).group(1)
    print('Statistics block written to %s (%s).' % (html_path.name, 'sending to ' + url if url else 'no address set yet, so nothing is sent'))

if __name__ == '__main__':
    main()
