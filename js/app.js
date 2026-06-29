/**
 * 国际物流助手 H5 - 主应用逻辑 v1.0
 * 功能：首页计算器、产品列表、海运报价、国家选择、产品详情
 * 架构：SPA + 哈希路由 + 客户端全量计算
 */

(function() {
  'use strict';

  /* ========== 全局状态 ========== */
  var state = {
    products: [],        // 全量产品数据（加载后）
    countries: [],       // 国家列表
    selectedCountry: null, // { code, name }
    selectedCargo: '普货',
    weightG: 500,         // 重量（克）
    sortMode: 'price',    // 'price' | 'speed'
    currentPage: 'home',
    displayProducts: [],   // 当前展示的产品（分页）
    allQueryResults: [],   // 全量查询结果（分页用）
    pageSize: 30,
    currentPageNum: 1,
    isLoading: false,
    detailProduct: null,    // 当前查看详情的产品
  };

  /* ========== 初始化 ========== */
  function init() {
    showLoading(true);
    // 并行加载产品和国家的 JSON 数据
    Promise.all([
      fetch('data/products.json').then(function(r) { return r.json(); }),
      fetch('data/countries.json').then(function(r) { return r.json(); })
    ]).then(function(results) {
      state.products = results[0];
      state.countries = results[1];
      console.log('[INIT] 产品数据加载成功：' + state.products.length + ' 条');
      console.log('[INIT] 国家数据加载成功：' + state.countries.length + ' 个');
      showLoading(false);
      bindEvents();
      renderCountryList();
      // 如果 URL 有哈希，跳对应页
      handleHashChange();
    }).catch(function(err) {
      console.error('[INIT] 数据加载失败：', err);
      showLoading(false);
      alert('数据加载失败，请刷新页面重试。');
    });
  }

  /* ========== 事件绑定 ========== */
  function bindEvents() {
    // 哈希路由
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    // 头部 Tab 切换
    var tabs = document.querySelectorAll('.header-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', handleTabClick);
    }

    // 国家选择按钮
    var btnCountry = document.getElementById('btnCountry');
    if (btnCountry) btnCountry.addEventListener('click', showCountryModal);

    // 货物类型 Chip
    var chips = document.querySelectorAll('#cargoChips .chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', handleCargoChipClick);
    }

    // 重量输入
    var inpWeight = document.getElementById('inpWeight');
    if (inpWeight) {
      inpWeight.addEventListener('input', handleWeightInput);
      inpWeight.value = state.weightG;
      updateWeightDisplay();
    }

    // 快捷重量按钮
    var qwBtns = document.querySelectorAll('.qw-btn');
    for (var i = 0; i < qwBtns.length; i++) {
      qwBtns[i].addEventListener('click', handleQuickWeightClick);
    }

    // 查询按钮
    var btnQuery = document.getElementById('btnQuery');
    if (btnQuery) btnQuery.addEventListener('click', handleQuery);

    // 排序切换
    var sortBtns = document.querySelectorAll('.sort-btn');
    for (var i = 0; i < sortBtns.length; i++) {
      sortBtns[i].addEventListener('click', handleSortChange);
    }

    // 国家搜索
    var inpCountrySearch = document.getElementById('inpCountrySearch');
    if (inpCountrySearch) inpCountrySearch.addEventListener('input', handleCountrySearch);

    // 关闭国家弹窗
    var btnCloseCountry = document.getElementById('btnCloseCountry');
    if (btnCloseCountry) btnCloseCountry.addEventListener('click', hideCountryModal);

    // 关闭详情弹窗
    var btnCloseDetail = document.getElementById('btnCloseDetail');
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', hideDetailModal);

    // 滚动加载更多
    window.addEventListener('scroll', handleScroll);

    // 清空筛选
    var btnClear = document.getElementById('btnClearFilter');
    if (btnClear) btnClear.addEventListener('click', handleClearFilter);
  }

  /* ========== 路由 ========== */
  function handleHashChange() {
    var hash = window.location.hash.replace('#', '') || 'home';
    switchPage(hash);
  }

  function switchPage(page) {
    state.currentPage = page;
    // 更新头部 Tab 高亮
    var tabs = document.querySelectorAll('.header-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.page === page);
    }
    // 显示对应页面
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.toggle('active', pages[i].id === 'page-' + page);
    }
    // 特殊处理
    if (page === 'home') {
      document.getElementById('main').style.paddingTop = '120rpx';
    }
  }

  /* ========== 国家选择 ========== */
  function showCountryModal() {
    renderCountryList();
    document.getElementById('modalCountry').classList.add('show');
    var inp = document.getElementById('inpCountrySearch');
    if (inp) inp.value = '';
    if (inp) inp.focus();
  }

  function hideCountryModal() {
    document.getElementById('modalCountry').classList.remove('show');
  }

  function renderCountryList(filter) {
    var list = document.getElementById('countryList');
    if (!list) return;
    var html = '';
    var countries = state.countries;
    if (filter) {
      var f = filter.toLowerCase();
      countries = countries.filter(function(c) {
        return c.name.toLowerCase().indexOf(f) >= 0 || c.code.toLowerCase().indexOf(f) >= 0;
      });
    }
    for (var i = 0; i < countries.length; i++) {
      var c = countries[i];
      html += '<div class="country-item" data-code="' + escH(c.code) + '">'
            + '<span>' + escH(c.name) + '</span>'
            + '<span class="cc">' + escH(c.code) + '</span>'
            + '</div>';
    }
    list.innerHTML = html;

    // 绑定点击事件
    var items = list.querySelectorAll('.country-item');
    for (var i = 0; i < items.length; i++) {
      (function(item) {
        item.addEventListener('click', function() {
          var code = item.dataset.code;
          var country = state.countries.find(function(c) { return c.code === code; });
          if (country) {
            state.selectedCountry = country;
            document.getElementById('txtCountry').textContent = country.name;
            hideCountryModal();
          }
        });
      })(items[i]);
    }
  }

  function handleCountrySearch() {
    var val = document.getElementById('inpCountrySearch').value;
    renderCountryList(val);
  }

  /* ========== 货物类型选择 ========== */
  function handleCargoChipClick(e) {
    var btn = e.currentTarget;
    var type = btn.dataset.type;
    if (!type) return;
    state.selectedCargo = type;
    var chips = document.querySelectorAll('#cargoChips .chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].dataset.type === type);
    }
  }

  /* ========== 重量输入 ========== */
  function handleWeightInput(e) {
    var val = e.target.value;
    var num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      state.weightG = num;
      updateWeightDisplay();
    }
  }

  function updateWeightDisplay() {
    var txtKg = document.getElementById('txtKg');
    if (txtKg) {
      var kg = state.weightG / 1000;
      txtKg.textContent = formatKg(kg);
    }
  }

  function formatKg(kg) {
    if (kg < 1) return kg.toFixed(3) + ' kg';
    if (kg < 10) return kg.toFixed(2) + ' kg';
    if (kg < 1000) return kg.toFixed(1) + ' kg';
    return Math.round(kg) + ' kg';
  }

  function handleQuickWeightClick(e) {
    var btn = e.currentTarget;
    var g = parseInt(btn.dataset.g, 10);
    if (!g) return;
    state.weightG = g;
    var inp = document.getElementById('inpWeight');
    if (inp) inp.value = g;
    updateWeightDisplay();
    // 高亮当前按钮
    var btns = document.querySelectorAll('.qw-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', parseInt(btns[i].dataset.g, 10) === g);
    }
  }

  /* ========== 核心查询 ========== */
  function handleQuery() {
    if (!state.selectedCountry) {
      alert('请先选择目的国家');
      return;
    }
    if (!state.weightG || state.weightG <= 0) {
      alert('请输入有效重量');
      return;
    }

    showLoading(true);

    // 异步计算（不阻塞 UI）
    setTimeout(function() {
      try {
        var results = doQuery(state.selectedCountry.code, state.selectedCargo, state.weightG);
        state.allQueryResults = results;
        state.currentPageNum = 1;

        // 分页展示
        var pageResults = results.slice(0, state.pageSize);
        state.displayProducts = pageResults;

        renderProductList(pageResults);
        updateSortBar(results.length);
        showLoading(false);

        // 滚动到结果区域
        var sortBar = document.getElementById('sortBar');
        if (sortBar) sortBar.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.error('[QUERY] 查询失败：', err);
        showLoading(false);
        alert('查询失败：' + err.message);
      }
    }, 50);
  }

  function doQuery(countryCode, cargoType, weightG) {
    console.log('[QUERY] 开始查询：country=' + countryCode + ' cargo=' + cargoType + ' weight=' + weightG + 'g');

    // Step1: 按国家过滤
    var results = LogisticsUtils.filterByCountry(state.products, countryCode);
    console.log('[QUERY] 国家过滤后：' + results.length);

    // Step2: 按货物类型过滤
    results = LogisticsUtils.filterByCargoType(results, cargoType);
    console.log('[QUERY] 货物类型过滤后：' + results.length);

    // Step3: 价格计算 + 数据标准化（对应小程序 _enrich）
    results = LogisticsUtils.enrichProducts(results, weightG, cargoType);
    console.log('[QUERY] enrich 后：' + results.length + ' 条，有价格：' + results.filter(function(p) { return p.isPriceable; }).length);

    // Step4: 过滤不可计价的产品
    results = results.filter(function(p) { return p.isPriceable; });
    console.log('[QUERY] 过滤不可计价后：' + results.length);

    // Step5: 按重量限制过滤
    results = LogisticsUtils.filterByWeight(results, weightG);
    console.log('[QUERY] 重量过滤后：' + results.length);

    // Step6: 排序
    results = sortProducts(results, state.sortMode);

    return results;
  }

  function sortProducts(products, mode) {
    var sorted = products.slice();
    if (mode === 'price') {
      sorted.sort(function(a, b) { return (a.price || 99999) - (b.price || 99999); });
    } else if (mode === 'speed') {
      sorted.sort(function(a, b) {
        var da = getTransitDays(a);
        var db = getTransitDays(b);
        return da - db;
      });
    }
    return sorted;
  }

  function getTransitDays(p) {
    if (p.details && p.details.transit) {
      var t = p.details.transit;
      if (t.avgDays) return t.avgDays;
      if (t.p80) return t.p80;
    }
    if (p.transitTime) {
      var m = p.transitTime.match(/(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
    return 999;
  }

  /* ========== 产品列表渲染 ========== */
  function renderProductList(products) {
    var container = document.getElementById('productList');
    var empty = document.getElementById('emptyState');
    var loadMore = document.getElementById('loadMore');

    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (loadMore) loadMore.style.display = 'none';
      return;
    }

    if (empty) empty.style.display = 'none';

    var html = '';
    for (var i = 0; i < products.length; i++) {
      html += renderProductCard(products[i], i);
    }
    container.innerHTML = html;

    // 绑定展开/收起事件
    bindCardEvents(container);

    // 显示/隐藏"加载更多"
    var totalResults = state.allQueryResults.length;
    var displayed = state.displayProducts.length;
    if (loadMore) {
      loadMore.style.display = (displayed < totalResults) ? 'block' : 'none';
    }
  }

  function renderProductCard(p, idx) {
    var priceStr = p.price !== null ? '¥' + p.price.toFixed(2) : '价格未知';
    var priceInt = p.price ? Math.floor(p.price) : '--';
    var priceDec = p.price ? ('.' + p.price.toFixed(2).split('.')[1]) : '';

    // 生成标签
    var tags = LogisticsUtils.generateCardTags(p);
    var tagsHtml = '';
    var allTags = (tags.row1 || []).concat(tags.row2 || []);
    for (var i = 0; i < Math.min(allTags.length, 6); i++) {
      var t = allTags[i];
      tagsHtml += '<span class="pc-tag pc-tag--' + (t.type || 'feature') + '">' + escH(t.text) + '</span>';
    }

    // 时效
    var transitHtml = '';
    if (p.transitTime) {
      transitHtml = '<div class="pc-meta-item">⏱ <span>' + escH(p.transitTime) + '</span></div>';
    }

    return '<div class="product-card" data-idx="' + idx + '">'
      + '  <div class="pc-header">'
      + '    <div class="pc-name">' + escH(p.name || '未知产品') + '</div>'
      + '    <div class="pc-price">'
      + '      <span class="pc-price-unit">¥</span>'
      + '      <span class="pc-price-int">' + priceInt + '</span>'
      + '      <span class="pc-price-dec">' + priceDec + '</span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="pc-tags">' + tagsHtml + '</div>'
      + '  <div class="pc-meta">' + transitHtml + '</div>'
      + '  <div class="pc-expand-btn" data-idx="' + idx + '">展开详情 ▾</div>'
      + '  <div class="pc-detail" id="detail-' + idx + '"></div>'
      + '</div>';
  }

  function bindCardEvents(container) {
    // 展开/收起按钮
    var btns = container.querySelectorAll('.pc-expand-btn');
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.dataset.idx, 10);
          toggleProductDetail(idx);
        });
      })(btns[i]);
    }
  }

  function toggleProductDetail(idx) {
    var p = state.displayProducts[idx];
    if (!p) return;

    var detailEl = document.getElementById('detail-' + idx);
    var btnEl = document.querySelector('.pc-expand-btn[data-idx="' + idx + '"]');

    if (!detailEl) return;

    if (detailEl.classList.contains('show')) {
      detailEl.classList.remove('show');
      detailEl.innerHTML = '';
      if (btnEl) btnEl.textContent = '展开详情 ▾';
    } else {
      detailEl.classList.add('show');
      detailEl.innerHTML = renderProductDetail(p);
      if (btnEl) btnEl.textContent = '收起详情 ▴';
    }
  }

  function renderProductDetail(p) {
    var html = '';

    // 价格明细
    html += '<div class="pc-detail-row">'
      + '<span class="pc-detail-label">计费重量：</span>'
      + '<span class="pc-detail-value">' + (state.weightG / 1000).toFixed(3) + ' kg</span>'
      + '</div>';

    if (p.price !== null) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">运费：</span>'
        + '<span class="pc-detail-value" style="color:var(--primary);font-weight:700;">¥ ' + p.price.toFixed(2) + '</span>'
        + '</div>';
    }

    // 时效详情
    if (p.details && p.details.transit) {
      var t = p.details.transit;
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">时效：</span>'
        + '<span class="pc-detail-value">';
      if (t.avgDays) html += '平均 ' + t.avgDays + ' 天';
      if (t.p80) html += '，P80 ' + t.p80 + ' 天';
      if (t.p90) html += '，P90 ' + t.p90 + ' 天';
      html += '</span></div>';
    } else if (p.transitTime) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">时效：</span>'
        + '<span class="pc-detail-value">' + escH(p.transitTime) + '</span>'
        + '</div>';
    }

    // 追踪
    if (p.details && p.details.tracking) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">追踪：</span>'
        + '<span class="pc-detail-value">' + escH(p.details.tracking) + '</span>'
        + '</div>';
    }

    // 清关
    if (p.details && p.details.customsClearance) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">清关：</span>'
        + '<span class="pc-detail-value">' + escH(p.details.customsClearance) + '</span>'
        + '</div>';
    }

    // 赔偿
    if (p.details && p.details.compensation) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">赔偿：</span>'
        + '<span class="pc-detail-value">' + escH(p.details.compensation) + '</span>'
        + '</div>';
    }

    // 禁寄物品
    if (p.prohibitedItems) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">禁寄：</span>'
        + '<span class="pc-detail-value">' + escH(p.prohibitedItems) + '</span>'
        + '</div>';
    }

    //  shippingRequirements
    if (p.shippingRequirements) {
      html += '<div class="pc-detail-row">'
        + '<span class="pc-detail-label">要求：</span>'
        + '<span class="pc-detail-value">' + escH(p.shippingRequirements) + '</span>'
        + '</div>';
    }

    return html;
  }

  /* ========== 排序栏 ========== */
  function updateSortBar(count) {
    var bar = document.getElementById('sortBar');
    var txt = document.getElementById('txtCount');
    if (bar) bar.style.display = (count > 0) ? 'flex' : 'none';
    if (txt) txt.textContent = '共 ' + count + ' 条渠道';
  }

  function handleSortChange(e) {
    var btn = e.currentTarget;
    var mode = btn.dataset.mode;
    if (!mode || mode === state.sortMode) return;
    state.sortMode = mode;

    // 更新按钮高亮
    var btns = document.querySelectorAll('.sort-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.mode === mode);
    }

    // 重新排序并渲染
    if (state.allQueryResults.length > 0) {
      state.allQueryResults = sortProducts(state.allQueryResults, mode);
      state.displayProducts = state.allQueryResults.slice(0, state.pageSize);
      renderProductList(state.displayProducts);
    }
  }

  /* ========== 滚动加载更多 ========== */
  function handleScroll() {
    if (state.isLoading) return;
    var loadMore = document.getElementById('loadMore');
    if (!loadMore || loadMore.style.display === 'none') return;

    var rect = loadMore.getBoundingClientRect();
    if (rect.top < window.innerHeight + 200) {
      loadMoreProducts();
    }
  }

  function loadMoreProducts() {
    if (state.isLoading) return;
    var total = state.allQueryResults.length;
    var displayed = state.displayProducts.length;
    if (displayed >= total) return;

    state.isLoading = true;
    var loadMore = document.getElementById('loadMore');
    if (loadMore) loadMore.textContent = '加载中...';

    // 模拟异步加载
    setTimeout(function() {
      var next = state.allQueryResults.slice(displayed, displayed + state.pageSize);
      state.displayProducts = state.displayProducts.concat(next);

      // 追加渲染（不是替换）
      var container = document.getElementById('productList');
      if (container) {
        for (var i = 0; i < next.length; i++) {
          var idx = displayed + i;
          container.insertAdjacentHTML('beforeend', renderProductCard(next[i], idx));
        }
        bindCardEvents(container);
      }

      state.isLoading = false;
      if (loadMore) {
        loadMore.textContent = '加载更多...';
        loadMore.style.display = (state.displayProducts.length < total) ? 'block' : 'none';
      }
    }, 200);
  }

  /* ========== 清空筛选 ========== */
  function handleClearFilter() {
    state.selectedCountry = null;
    state.weightG = 500;
    var txtCountry = document.getElementById('txtCountry');
    if (txtCountry) txtCountry.textContent = '请选择国家';
    var inpWeight = document.getElementById('inpWeight');
    if (inpWeight) inpWeight.value = 500;
    updateWeightDisplay();
    renderProductList([]);
    updateSortBar(0);
  }

  /* ========== UI 工具函数 ========== */
  function showLoading(show) {
    var el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  function escH(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ========== 启动 ========== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
