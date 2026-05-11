import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const docsDir = "docs";
const postsDir = join(docsDir, "blogpost");
const postsJsonPath = join(docsDir, "posts.json");
const indexPath = join(docsDir, "index.html");

const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md")).sort();
const posts = [];

for (const file of files) {
  const sourcePath = join(postsDir, file);
  const source = await readFile(sourcePath, "utf8");
  const { metadata, body } = parseFrontMatter(source, file);
  if (metadata.draft === true) continue;

  const slug = metadata.slug ?? basename(file, ".md");
  const htmlFile = `${slug}.html`;
  const post = {
    title: requireString(metadata.title, file, "title"),
    slug,
    date: requireString(metadata.date, file, "date"),
    type: typeof metadata.type === "string" ? metadata.type : "post",
    tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : [],
    summary: requireString(metadata.summary, file, "summary"),
    featured: metadata.featured === true,
    sourceUrl: `blogpost/${file}`,
    url: `blogpost/${htmlFile}`,
  };

  posts.push(post);
  await writeFile(join(postsDir, htmlFile), renderPostPage(post, body), "utf8");
}

posts.sort((left, right) => right.date.localeCompare(left.date) || left.title.localeCompare(right.title));
await writeFile(postsJsonPath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
await writeFile(indexPath, renderIndexPage(posts), "utf8");

console.log(`Built ${posts.length.toString()} docs post${posts.length === 1 ? "" : "s"}.`);

function parseFrontMatter(source, file) {
  if (!source.startsWith("---\n")) throw new Error(`${file} is missing front matter`);
  const end = source.indexOf("\n---\n", 4);
  if (end === -1) throw new Error(`${file} has unterminated front matter`);
  return {
    metadata: parseYamlSubset(source.slice(4, end)),
    body: source.slice(end + 5).trim(),
  };
}

function parseYamlSubset(text) {
  const result = {};
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const match = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`Unsupported front matter line: ${line}`);
    const key = match[1];
    const value = match[2];
    if (value === "") {
      const list = [];
      while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
        index += 1;
        list.push(unquote(lines[index].replace(/^\s+-\s+/, "").trim()));
      }
      result[key] = list;
      continue;
    }
    if (value === "true") result[key] = true;
    else if (value === "false") result[key] = false;
    else result[key] = unquote(value);
  }
  return result;
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

function requireString(value, file, key) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${file} front matter is missing ${key}`);
  return value;
}

function renderIndexPage(posts) {
  const featured = posts.find((post) => post.featured) ?? posts[0];
  const postsData = escapeHtml(JSON.stringify(posts));
  const featuredCard = featured ? `
          <article class="featured-post-card">
            <span class="kicker">${escapeHtml(featured.type)} · ${formatDate(featured.date)}</span>
            <h2>${escapeHtml(featured.title)}</h2>
            <p>${escapeHtml(featured.summary)}</p>
            <div class="tag-row">${featured.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
            <a class="button primary" href="${escapeAttribute(featured.url)}">Read latest</a>
          </article>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GPi Notes — essays and release notes</title>
  <meta name="description" content="Static notes, essays, and release writeups for GPi." />
  <link rel="icon" href="assets/gpi-icon.svg" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="site-header">
    <nav class="nav page-shell" aria-label="Main navigation">
      <a class="brand" href="index.html" aria-label="GPi Notes home"><img src="assets/gpi-icon.svg" alt="" /> GPi Notes</a>
      <div class="nav-links">
        <a href="#timeline">Timeline</a>
        <a href="#search">Search</a>
        <a href="https://github.com/SynrgStudio/gpi">GitHub</a>
      </div>
    </nav>
  </header>

  <main>
    <section class="hero page-shell docs-home-hero">
      <div>
        <span class="kicker">Essays · changelogs · field notes</span>
        <h1>Operational notes for building with long-running agents.</h1>
        <p class="hero-lede">A static, searchable notebook for GPi: why changes exist, what they changed, and what the workflow taught along the way.</p>
      </div>
      ${featuredCard}
    </section>

    <section class="posts-panel page-shell" id="search">
      <div class="posts-panel-header">
        <div>
          <span class="kicker">Archive</span>
          <h2>Posts and release notes</h2>
        </div>
        <label class="search-box">
          <span>Search</span>
          <input id="post-search" type="search" placeholder="skills, continuity, release notes..." />
        </label>
      </div>
      <div class="timeline" id="timeline" data-posts="${postsData}"></div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="page-shell footer-inner">
      <span>GPi Notes — generated from markdown in <code>docs/blogpost</code>.</span>
      <a href="https://github.com/SynrgStudio/gpi">github.com/SynrgStudio/gpi</a>
    </div>
  </footer>

  <script>
    const timeline = document.getElementById("timeline");
    const search = document.getElementById("post-search");
    const posts = JSON.parse(timeline.dataset.posts ?? "[]");

    function renderPosts(query = "") {
      const normalized = query.trim().toLowerCase();
      const filtered = posts.filter((post) => {
        const haystack = [post.title, post.summary, post.type, ...(post.tags ?? [])].join(" ").toLowerCase();
        return haystack.includes(normalized);
      });
      timeline.innerHTML = filtered.length === 0
        ? '<div class="empty-posts">No posts matched that search.</div>'
        : filtered.map(renderPost).join("");
    }

    function renderPost(post) {
      const tags = (post.tags ?? []).map((tag) => '<span>' + escapeHtml(tag) + '</span>').join("");
      return '<article class="timeline-post">'
        + '<time>' + escapeHtml(formatDate(post.date)) + '</time>'
        + '<div class="timeline-post-body">'
        + '<a href="' + escapeAttribute(post.url) + '"><h3>' + escapeHtml(post.title) + '</h3></a>'
        + '<p>' + escapeHtml(post.summary) + '</p>'
        + '<div class="tag-row"><span>' + escapeHtml(post.type) + '</span>' + tags + '</div>'
        + '</div>'
        + '</article>';
    }

    function formatDate(value) {
      return new Date(value + 'T00:00:00').toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function escapeAttribute(value) {
      return escapeHtml(value);
    }

    search.addEventListener("input", () => renderPosts(search.value));
    renderPosts();
  </script>
</body>
</html>
`;
}

function renderPostPage(post, body) {
  const headings = extractHeadings(body);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(post.title)} — GPi Notes</title>
  <meta name="description" content="${escapeAttribute(post.summary)}" />
  <meta property="og:title" content="${escapeAttribute(post.title)}" />
  <meta property="og:description" content="${escapeAttribute(post.summary)}" />
  <meta property="og:type" content="article" />
  <link rel="icon" href="../assets/gpi-icon.svg" />
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  <header class="site-header">
    <nav class="nav page-shell" aria-label="Main navigation">
      <a class="brand" href="../index.html" aria-label="GPi Notes home"><img src="../assets/gpi-icon.svg" alt="" /> GPi Notes</a>
      <div class="nav-links">
        <a href="../index.html#timeline">Timeline</a>
        <a href="${escapeAttribute(post.sourceUrl)}">Markdown</a>
        <a href="https://github.com/SynrgStudio/gpi">GitHub</a>
      </div>
    </nav>
  </header>

  <main>
    <section class="post-hero page-shell">
      <span class="kicker">${escapeHtml(post.type)} · ${formatDate(post.date)}</span>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.summary)}</p>
      <div class="tag-row">${post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </section>

    <div class="article-layout page-shell">
      <aside class="toc" aria-label="Article sections">
        <strong>Contents</strong>
        ${headings.map((heading) => `<a href="#${escapeAttribute(heading.id)}">${escapeHtml(heading.text)}</a>`).join("\n        ")}
      </aside>
      <article class="article">
        ${markdownToHtml(body)}
      </article>
    </div>
  </main>

  <footer class="site-footer">
    <div class="page-shell footer-inner">
      <span>GPi Notes — generated from markdown.</span>
      <a href="../index.html">Back to archive</a>
    </div>
  </footer>
</body>
</html>
`;
}

function extractHeadings(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("## "))
    .map((line) => line.replace(/^##\s+/, "").trim())
    .map((text) => ({ text: stripInlineMarkdown(text), id: slugify(stripInlineMarkdown(text)) }));
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  let blockquote = [];
  let inCode = false;
  let code = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    html.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  function flushBlockquote() {
    if (blockquote.length === 0) return;
    html.push(`<blockquote><p>${renderInline(blockquote.join("<br><br>"))}</p></blockquote>`);
    blockquote = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushBlockquote();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    if (line.startsWith("# ")) continue;

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const text = line.replace(/^##\s+/, "").trim();
      html.push(`<h2 id="${escapeAttribute(slugify(stripInlineMarkdown(text)))}">${renderInline(text)}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const text = line.replace(/^###\s+/, "").trim();
      html.push(`<h3>${renderInline(text)}</h3>`);
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blockquote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      flushBlockquote();
      list.push(line.replace(/^-\s+/, ""));
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushBlockquote();
  if (inCode) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return html.join("\n        ");
}

function renderInline(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/—/g, "—");
}

function stripInlineMarkdown(text) {
  return text.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
