/* ============================================================
   VirWave — Blog JS
   Handles: blog listing, post rendering, tag filtering,
            homepage blog preview
   ============================================================ */

(function () {
  'use strict';

  var base = '';

  function getBase() {
    if (base) return base;
    var meta = document.querySelector('meta[name="base-path"]');
    base = meta ? meta.getAttribute('content') : '/';
    return base;
  }

  /* --- Load posts.json --------------------------------------- */
  async function loadPosts() {
    try {
      var res = await fetch(getBase() + 'blog/posts.json');
      if (!res.ok) return [];
      var posts = await res.json();
      // Sort by date descending
      posts.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
      return posts;
    } catch {
      return [];
    }
  }

  /* --- Format date ------------------------------------------- */
  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* --- Render a blog card ------------------------------------ */
  function renderCard(post) {
    var tags = (post.tags || []).map(function (t) {
      return '<span class="tag">' + t + '</span>';
    }).join('');

    return '<article class="blog-card">' +
      '<time class="blog-card-date" datetime="' + post.date + '">' + formatDate(post.date) + '</time>' +
      '<h3><a href="' + getBase() + 'blog/post.html?slug=' + encodeURIComponent(post.slug) + '">' + post.title + '</a></h3>' +
      '<p>' + (post.description || '') + '</p>' +
      '<div class="blog-card-tags">' + tags + '</div>' +
      '</article>';
  }

  /* --- Homepage blog preview --------------------------------- */
  async function initHomeBlogPreview() {
    var container = document.getElementById('blog-preview');
    if (!container) return;

    var posts = await loadPosts();
    container.classList.remove('loading');
    if (!posts.length) {
      container.innerHTML = '<p class="text-center text-muted">No posts yet. Check back soon.</p>';
      return;
    }

    var latest = posts.slice(0, 3);
    container.innerHTML = '<div class="card-grid card-grid-3">' +
      latest.map(renderCard).join('') +
      '</div>';
  }

  /* --- Blog listing page ------------------------------------- */
  async function initBlogListing() {
    var container = document.getElementById('blog-list');
    var filter = document.getElementById('blog-filter');
    if (!container) return;

    var posts = await loadPosts();
    container.classList.remove('loading');
    if (!posts.length) {
      container.innerHTML = '<div class="empty-state"><h2>No posts yet</h2><p>Check back soon for new content.</p></div>';
      return;
    }

    // Collect tags
    var allTags = [];
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        if (allTags.indexOf(t) === -1) allTags.push(t);
      });
    });
    allTags.sort();

    // Populate filter
    if (filter) {
      var opts = '<option value="">All topics</option>';
      allTags.forEach(function (t) {
        opts += '<option value="' + t + '">' + t + '</option>';
      });
      filter.innerHTML = opts;

      filter.addEventListener('change', function () {
        renderList(posts, filter.value);
      });
    }

    // Check for tag in URL
    var params = new URLSearchParams(window.location.search);
    var initialTag = params.get('tag') || '';
    if (filter && initialTag) filter.value = initialTag;

    renderList(posts, initialTag);

    function renderList(posts, tag) {
      var filtered = tag ? posts.filter(function (p) {
        return (p.tags || []).indexOf(tag) !== -1;
      }) : posts;

      if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><p>No posts match this filter.</p></div>';
        return;
      }

      container.innerHTML = '<div class="card-grid card-grid-3">' +
        filtered.map(renderCard).join('') +
        '</div>';

      staggerBlogCards(container.querySelectorAll('.blog-card'));
    }
  }

  /* Stagger-reveal blog cards after DOM insertion */
  function staggerBlogCards(cards) {
    if (!cards || !cards.length) return;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(cards, function (card, i) {
      card.classList.add('stagger-enter');
      card.style.setProperty('--stagger-delay', (i * 80) + 'ms');
      if (reducedMotion) {
        card.classList.add('stagger-visible');
      } else {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            card.classList.add('stagger-visible');
          });
        });
      }
    });
  }

  /* --- Single post page -------------------------------------- */
  async function initBlogPost() {
    var header = document.getElementById('post-header');
    var body = document.getElementById('post-body');
    if (!header || !body) return;

    body.classList.remove('loading');
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    if (!slug) {
      body.innerHTML = '<div class="empty-state"><h2>Post not found</h2><p>No post slug provided.</p><a href="' + getBase() + 'blog/" class="btn btn-ghost-dark btn-sm">Back to blog</a></div>';
      return;
    }

    var posts = await loadPosts();
    var post = posts.find(function (p) { return p.slug === slug; });
    if (!post) {
      body.innerHTML = '<div class="empty-state"><h2>Post not found</h2><p>Could not find a post with that URL.</p><a href="' + getBase() + 'blog/" class="btn btn-ghost-dark btn-sm">Back to blog</a></div>';
      return;
    }

    // Update page title & OG
    document.title = post.title + ' — VirWave Blog';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', post.description || '');
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', post.title);
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', post.description || '');

    // Render header
    var tags = (post.tags || []).map(function (t) {
      return '<span class="tag">' + t + '</span>';
    }).join(' ');

    header.innerHTML = '<div class="container">' +
      '<h1>' + post.title + '</h1>' +
      '<div class="post-meta">' +
        '<time datetime="' + post.date + '">' + formatDate(post.date) + '</time>' +
        (tags ? ' &middot; ' + tags : '') +
      '</div>' +
    '</div>';

    // Fetch and render markdown
    try {
      var mdRes = await fetch(getBase() + 'blog/posts/' + post.file);
      if (!mdRes.ok) throw new Error('Failed to load post');
      var mdText = await mdRes.text();
      body.innerHTML = VWMarkdown.parse(mdText);
    } catch (err) {
      body.innerHTML = '<div class="empty-state"><h2>Error loading post</h2><p>Could not load the post content. Please try again.</p></div>';
    }
  }

  /* --- Init based on page ------------------------------------ */
  function init() {
    // Homepage preview
    if (document.getElementById('blog-preview')) {
      initHomeBlogPreview();
    }
    // Blog listing
    if (document.getElementById('blog-list')) {
      initBlogListing();
    }
    // Single post
    if (document.getElementById('post-body')) {
      initBlogPost();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
