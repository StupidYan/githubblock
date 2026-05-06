// ==UserScript==
// @name         GitHub 净化大师 (高性能版)
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  支持用户、仓库、关键字、正则表达式的多重过滤，带防抖优化，防止页面卡顿。
// @author       aNzi
// @match        https://github.com/search*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    /**
     * ==========================================
     * 用户配置区
     * ==========================================
     */
    const CONFIG = {
        // 1. 屏蔽特定用户 (精准匹配)
        USERS: [
            '1lixia', 'b0LBwZ7r5HOeh6CBMuQIhVu3-s-random-fork', 'Bellum45',
            'candice531033938', 'cheezcharmer', 'chinese-dictatorship',
            'cirosantilli', 'codin-stuffs', 'Daravai1234', 'Dimples1337',
            'Dujltqzv', 'gege-circle', 'jjzhang166', 'jk-ice-cream',
            'lattic', 'panbinibn', 'pxvr-official', 'random-fork',
            'sky8964', 'tjqJ62cESiHPj6DdR6vXDAcPp', 'wumaoland',
            'zaohmeing', 'zhaohmng-outlook-com', 'zpc1314521'
        ],

        // 2. 屏蔽特定仓库 (精准匹配，格式：'user/repo')
        REPOS: [
            '牛子通信/', 'PCL2/', 'PCL/',
            'mRFWq7LwNPZjaVv5v6eo/', 'b0LBwZ7r5HOeh6CBMuQIhVu3-s-random-fork/'
        ],

        // 3. 屏蔽关键字 (模糊匹配标题、描述、内容)
        KEYWORDS: [
            '刷分', '无意义', '自动生成的项目', '牛子通信'
        ],

        // 4. 正则表达式屏蔽 (针对乱码用户名或特定模式)
        REGEX_PATTERNS: [
            /[a-zA-Z0-9]{20,}/, // 匹配过长的乱码 ID
            /test-pattern-\d+/i
        ],

        // 5. 核心设置
        SETTINGS: {
            USE_URL_QUERY: true, // 是否修改 URL 关键词（强力拦截）
            HIDE_DOM: true,       // 是否扫描 DOM 隐藏（精准清理）
            DEBOUNCE_MS: 150      // 防抖延迟，防止滚动时 CPU 占用过高
        }
    };

    /**
     * ==========================================
     * 核心逻辑区
     * ==========================================
     */

    // 预处理屏蔽列表，去除尾部斜杠并转为小写
    const cleanUsers = CONFIG.USERS.map(u => u.toLowerCase());
    const cleanRepos = CONFIG.REPOS.map(r => r.replace(/\/$/, '').toLowerCase());

    const blockQueries = [
        ...cleanUsers.map(u => `-user:${u}`),
        ...cleanRepos.map(r => `-repo:${r}`)
    ];

    // 逻辑 A: URL 查询参数拦截
    function purifyURL() {
        if (!CONFIG.SETTINGS.USE_URL_QUERY) return;

        const urlParams = new URLSearchParams(window.location.search);
        let q = urlParams.get('q') || '';
        let needsUpdate = false;

        // 为避免 URL 过长导致 413 错误，限制注入前 30 个核心屏蔽项
        const limitedQueries = blockQueries.slice(0, 30);

        limitedQueries.forEach(term => {
            if (!q.includes(term)) {
                q += ` ${term}`;
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            urlParams.set('q', q);
            // 使用 replace 避免污染浏览器历史记录（防止无法点击“后退”）
            window.location.replace(`${window.location.pathname}?${urlParams.toString()}`);
        }
    }

    // 逻辑 B: DOM 扫描与精准隐藏
    function hideByDOM() {
        if (!CONFIG.SETTINGS.HIDE_DOM) return;

        // 覆盖新版和旧版 GitHub 搜索结果容器
        const items = document.querySelectorAll('div[data-testid="results-list"] > div, .repo-list-item, div[data-testid="code-search-result"]');

        items.forEach(item => {
            if (item.getAttribute('data-purified')) return; // 避免重复扫描

            const text = item.innerText.toLowerCase();
            
            // 1. 获取当前条目的用户名 (通过 href 匹配)
            const userLink = item.querySelector('a[data-hovercard-type="user"], a[href^="/"]');
            const currentPath = userLink ? userLink.getAttribute('href').replace(/^\//, '').toLowerCase() : '';
            const [currentUID, currentRepoName] = currentPath.split('/');

            // 2. 判定逻辑
            const isBlackUser = cleanUsers.includes(currentUID);
            const isBlackRepo = cleanRepos.includes(`${currentUID}/${currentRepoName}`);
            const hasKeyword = CONFIG.KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
            const hasRegex = CONFIG.REGEX_PATTERNS.some(re => re.test(text));

            if (isBlackUser || isBlackRepo || hasKeyword || hasRegex) {
                item.style.setProperty('display', 'none', 'important');
            }
            
            item.setAttribute('data-purified', 'true'); // 标记已处理
        });
    }

    // 防抖函数：性能守护者
    function debounce(fn, delay) {
        let timer = null;
        return function() {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, arguments), delay);
        };
    }

    const debouncedHide = debounce(hideByDOM, CONFIG.SETTINGS.DEBOUNCE_MS);

    /**
     * ==========================================
     * 执行控制器
     * ==========================================
     */

    // 1. 拦截提交动作：在按下回车的一瞬间注入屏蔽词
    window.addEventListener('submit', (e) => {
        const searchInput = e.target.querySelector('input[name="q"]');
        if (searchInput && CONFIG.SETTINGS.USE_URL_QUERY) {
            blockQueries.slice(0, 30).forEach(term => {
                if (!searchInput.value.includes(term)) {
                    searchInput.value += ` ${term}`;
                }
            });
        }
    }, true);

    // 2. 初始执行
    if (window.location.href.includes('/search')) {
        purifyURL();
    }

    // 3. 动态监听：处理 AJAX 翻页和异步加载
    const observer = new MutationObserver((mutations) => {
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasAddedNodes) debouncedHide();
    });

    document.addEventListener('DOMContentLoaded', () => {
        hideByDOM();
        const container = document.querySelector('main');
        if (container) {
            observer.observe(container, { childList: true, subtree: true });
        }
    });

})();
