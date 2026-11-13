
## Research Room landing page

GitHub Actions builds the Jekyll site, then publishes the static room at `/`
and the Jekyll home at `/portfolio/` to `snawarhussain/BigBlunders`.
The Portfolio shortcut embeds `/portfolio/` on the same origin.
Existing routes such as `/blog/` and `/cv/` keep their URLs.

Edit posts, pages, and theme files as usual. Update the 3D build under
`research-room/` independently. Changes pushed to `main` run the existing
publication workflow using its `PUBLIC_REPO_ACCESS_TOKEN`.

To preview both parts together, run `bundle exec jekyll build`,
`bash scripts/assemble-pages.sh _site`, then
`python3 -m http.server --directory _site 8000`.
