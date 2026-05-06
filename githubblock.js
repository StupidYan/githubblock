// ==UserScript==
// @name         GitHub 净化大师 (配置化版)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  支持用户、仓库、关键字、描述内容的自定义屏蔽
// @author       aNzi
// @match        https://github.com/search*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    /**
     * ==========================================
     * 用户配置区 - 在这里添加你想屏蔽的内容
     * ==========================================
     */
    const CONFIG = {
        // 1. 屏蔽特定用户 (精准匹配用户名)
        USERS: [
            'cirosantilli', 'wumaoland', '1lixia', 'lattic', 'codin-stuffs',
            'cheezcharmer', 'Dimples1337', 'Dujltqzv', 'gege-circle',
            'zhaohmng-outlook-com', 'zaohmeing', 'Daravai1234',
            'candice531033938', 'jk-ice-cream', 'sky8964', 'pxvr-official',
            'zpc1314521', 'jjzhang166', 'panbinibn'
        ],

        // 2. 屏蔽特定仓库 (格式: '用户名/仓库名')
        REPOS: [
            '牛子通信/', 'PCL2/', 'PCL/',
            'mRFWq7LwNPZjaVv5v6eo/', 'b0LBwZ7r5HOeh6CBMuQIhVu3-s-random-fork/'
        ],

        // 3. 屏蔽标题或描述中的关键字 (模糊匹配，不区分大小写)
        KEYWORDS: [
            '刷分', '无意义', '自动生成的项目', '牛子通信'
        ],

        // 4. 高级屏蔽：正则表达式 (针对复杂的内容模式)
        REGEX_PATTERNS: [
            /test-pattern-\d+/i, // 示例：屏蔽匹配 test-pattern-数字 的内容
        ],

        // 5. 屏蔽设置
        SETTINGS: {
            USE_URL_QUERY: true, // 是否自动在搜索框补全 -user: 语法 (效果最强)
            HIDE_DOM: true       // 是否在页面渲染后强行隐藏 (处理关键词最有效)
        }
    };

    /**
     * ==========================================
     * 核心逻辑区 - 建议不要轻易修改
     * ==========================================
     */

    // 预处理搜索语法
    const blockQueries = [
        ...CONFIG.USERS.map(u => `-user:${u.replace(/\/$/, '')}`),
        ...CONFIG.REPOS.map(r => `-repo:${r.replace(/\/$/, '')}`)
    ];

    // 逻辑 A: 修改 URL 查询参数
    function purifyURL() {
        if (!CONFIG.SETTINGS.USE_URL_QUERY) return;

        const urlParams = new URLSearchParams(window.location.search);
        let q = urlParams.get('q') || '';
        let needsUpdate = false;

        blockQueries.forEach(term => {
            if (!q.includes(term)) {
                q += ` ${term}`;
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            urlParams.set('q', q);
            window.location.replace(`${window.location.pathname}?${urlParams.toString()}`);
        }
    }

    // 逻辑 B: 扫描并隐藏 DOM 元素
    function hideByDOM() {
        if (!CONFIG.SETTINGS.HIDE_DOM) return;

        // 兼容 GitHub 不同的搜索结果布局
        const items = document.querySelectorAll('div[data-testid="results-list"] > div, .repo-list-item');

        items.forEach(item => {
            const text = item.innerText.toLowerCase();

            // 匹配关键词
            const hasKeyword = CONFIG.KEYWORDS.some(kw => text.includes(kw.toLowerCase()));

            // 匹配正则
            const hasRegex = CONFIG.REGEX_PATTERNS.some(re => re.test(text));

            // 匹配用户/仓库 (二次兜底)
            const hasUserOrRepo = [...CONFIG.USERS, ...CONFIG.REPOS].some(target => {
                const cleanTarget = target.replace(/\/$/, '').toLowerCase();
                return text.includes(cleanTarget);
            });

            if (hasKeyword || hasRegex || hasUserOrRepo) {
                item.style.setProperty('display', 'none', 'important');
            }
        });
    }

    // --- 执行与监听 ---

    // 立即拦截搜索提交动作
    window.addEventListener('submit', (e) => {
        const searchInput = e.target.querySelector('input[name="q"]');
        if (searchInput && CONFIG.SETTINGS.USE_URL_QUERY) {
            blockQueries.forEach(term => {
                if (!searchInput.value.includes(term)) {
                    searchInput.value += ` ${term}`;
                }
            });
        }
    }, true);

    // URL 拦截
    if (window.location.href.includes('/search')) {
        purifyURL();
    }

    // 动态加载监听
    const observer = new MutationObserver(hideByDOM);
    document.addEventListener('DOMContentLoaded', () => {
        hideByDOM();
        const container = document.querySelector('main');
        if (container) {
            observer.observe(container, { childList: true, subtree: true });
        }
    });

})();
