/**
 * 主页面逻辑
 */

// 页面标题映射
const PAGE_TITLES = {
    'dashboard': '工作台',
    'assets': '设备台账',
    'workorders': '工单管理',
    'maintenance': '保养计划',
    'inspections': '点检记录',
    'spareparts': '备件管理',
    'reports': '报表统计'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.warn('未找到access_token，但继续加载页面用于测试');
        // 临时注释掉跳转，用于测试界面
        // window.location.href = '/static/login.html';
        // return;
    }
    console.log('已登录，token存在');

    initNavigation();
    initLogout();
    loadUserInfo();
    loadDashboard();
});

/**
 * 初始化导航
 */
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // 移除所有active状态
            navItems.forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.page-container').forEach(page => page.classList.remove('active'));

            // 添加当前active状态
            item.classList.add('active');
            const pageName = item.getAttribute('data-page');
            document.getElementById(`page-${pageName}`).classList.add('active');

            // 更新标题
            document.getElementById('pageTitle').textContent = PAGE_TITLES[pageName];

            // 加载页面数据
            loadPageData(pageName);
        });
    });
}

/**
 * 初始化登出
 */
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async () => {
        if (confirm('确定要退出登录吗？')) {
            try {
                await API.logout();
            } catch (e) {
                console.error('登出请求失败:', e);
            } finally {
                localStorage.clear();
                window.location.href = '/static/login.html';
            }
        }
    });
}

/**
 * 加载用户信息
 */
function loadUserInfo() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            document.getElementById('userName').textContent = user.full_name || user.username || '用户';
            document.getElementById('userAvatar').textContent = (user.full_name || user.username || 'A')[0].toUpperCase();
        } catch (e) {
            console.error('解析用户信息失败:', e);
        }
    }
}

/**
 * 加载页面数据
 */
function loadPageData(pageName) {
    switch (pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'assets':
            loadAssetsPage();
            break;
        case 'workorders':
            loadWorkOrders();
            break;
        case 'maintenance':
            loadMaintenance();
            break;
        case 'inspections':
            loadInspections();
            break;
        case 'spareparts':
            loadSpareParts();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

/**
 * 加载工作台数据
 */
async function loadDashboard() {
    try {
        // 加载统计数据
        const [assetsRes, workOrdersRes, partsRes] = await Promise.all([
            API.getAssets({ page_size: 1, status: 'active' }),
            API.getWorkOrders({ page_size: 1 }),
            API.getSpareParts({ page_size: 100, low_stock: 'true' })
        ]);

        // 更新统计卡片
        document.getElementById('statTotalAssets').textContent = assetsRes.count || 0;

        const activeWO = workOrdersRes.results?.filter(w => ['assigned', 'in_progress'].includes(w.status)).length || 0;
        document.getElementById('statActiveWorkOrders').textContent = activeWO;

        const pendingWO = workOrdersRes.results?.filter(w => w.status === 'open').length || 0;
        document.getElementById('statPendingWorkOrders').textContent = pendingWO;

        const lowStock = partsRes.results?.filter(p => p.current_stock <= p.min_stock).length || 0;
        document.getElementById('statLowStockParts').textContent = lowStock;

        // 加载最近工单
        const recentRes = await API.getWorkOrders({ page_size: 10, ordering: '-created_at' });
        renderRecentWorkOrders(recentRes.results || []);

    } catch (error) {
        console.error('加载工作台数据失败:', error);
    }
}

/**
 * 渲染最近工单
 */
function renderRecentWorkOrders(workOrders) {
    const tbody = document.getElementById('recentWorkOrders');

    if (!workOrders || workOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--gray-500);">暂无工单</td></tr>';
        return;
    }

    tbody.innerHTML = workOrders.map(wo => `
        <tr>
            <td>${wo.wo_code || '-'}</td>
            <td>${wo.equipment_name || '-'}</td>
            <td>${wo.type || '-'}</td>
            <td>${renderPriorityBadge(wo.priority)}</td>
            <td>${renderStatusBadge(wo.status)}</td>
            <td>${formatDate(wo.created_at)}</td>
        </tr>
    `).join('');
}

/**
 * 加载设备台账页面
 */
async function loadAssetsPage() {
    const container = document.getElementById('page-assets');

    // 检查页面是否已经初始化（有完整的HTML结构）
    const isInitialized = container.querySelector('#assetsTableBody') !== null;

    // 如果没有初始化，不重新生成HTML（HTML已在index.html中定义）
    // 只加载数据
    if (isInitialized) {
        // 页面已初始化，只需刷新数据
        console.log('设备台账页面已初始化，调用loadAssets加载数据');
        if (typeof loadAssets === 'function') {
            loadAssets();
        } else {
            console.error('loadAssets函数未定义');
        }
    } else {
        console.warn('设备台账页面HTML未正确初始化');
        console.log('容器元素:', container);
        console.log('查找assetsTableBody:', container.querySelector('#assetsTableBody'));
    }
}

// ========== 设备台账新功能 ==========

/**
 * 数据同步 - 从外部系统同步设备数据
 */
async function syncAssetsFromExternal() {
    if (!confirm('确定要从外部系统同步设备数据吗？这将覆盖重复编码的设备。')) {
        return;
    }

    showMessage('正在同步数据，请稍候...', 'info');

    try {
        // 调用数据同步API
        const response = await fetch('/api/assets/sync_from_external/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(() => {
                    const token = localStorage.getItem('access_token');
                    return token ? { 'Authorization': `Bearer ${token}` } : {};
                })()
            }
        });

        if (response.ok) {
            const result = await response.json();
            showMessage(`同步成功！新增 ${result.created || 0} 条，更新 ${result.updated || 0} 条，跳过 ${result.skipped || 0} 条`, 'success');
            loadAssets(); // 刷新列表
        } else {
            const error = await response.json().catch(() => ({}));
            showMessage('同步失败: ' + (error.detail || error.message || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('数据同步失败:', error);
        showMessage('同步失败: ' + error.message, 'error');
    }
}

/**
 * 切换批量操作区域显示
 */
function toggleBatchActions() {
    const area = document.getElementById('batchActionsArea');
    area.style.display = area.style.display === 'none' ? 'flex' : 'none';
}

/**
 * 切换高级筛选区域显示
 */
function toggleAdvancedFilter() {
    const area = document.getElementById('advancedFilterArea');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

/**
 * 全选/取消全选
 */
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.asset-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateSelectedCount();
}

/**
 * 更新选中数量
 */
function updateSelectedCount() {
    const count = document.querySelectorAll('.asset-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = count;
    const area = document.getElementById('batchActionsArea');
    if (count > 0) {
        area.style.display = 'flex';
    }
}

/**
 * 清除批量选择
 */
function clearBatchSelection() {
    document.querySelectorAll('.asset-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('selectAllAssets').checked = false;
    updateSelectedCount();
    document.getElementById('batchActionsArea').style.display = 'none';
}

/**
 * 批量编辑设备
 */
function batchEditAssets() {
    const selected = Array.from(document.querySelectorAll('.asset-checkbox:checked')).map(cb => parseInt(cb.value));
    if (selected.length === 0) {
        showMessage('请先选择要编辑的设备', 'warning');
        return;
    }
    showMessage(`已选择 ${selected.length} 个设备，批量编辑功能开发中...`, 'info');
}

/**
 * 批量修改状态
 */
function batchUpdateStatus() {
    const selected = Array.from(document.querySelectorAll('.asset-checkbox:checked')).map(cb => parseInt(cb.value));
    if (selected.length === 0) {
        showMessage('请先选择要修改的设备', 'warning');
        return;
    }
    document.getElementById('batchStatusCount').textContent = selected.length;
    document.getElementById('batchStatusModal').classList.add('show');
}

/**
 * 确认批量修改状态
 */
async function confirmBatchStatusUpdate() {
    const selected = Array.from(document.querySelectorAll('.asset-checkbox:checked')).map(cb => parseInt(cb.value));
    const newStatus = document.getElementById('batchNewStatus').value;

    try {
        const promises = selected.map(id => API.patch(`/assets/${id}/`, { status: newStatus }));
        await Promise.all(promises);

        showMessage(`成功修改 ${selected.length} 个设备的状态`, 'success');
        closeBatchStatusModal();
        clearBatchSelection();
        loadAssets();
    } catch (error) {
        console.error('批量修改状态失败:', error);
        showMessage('批量修改失败: ' + error.message, 'error');
    }
}

/**
 * 关闭批量修改状态模态框
 */
function closeBatchStatusModal() {
    document.getElementById('batchStatusModal').classList.remove('show');
}

/**
 * 批量删除设备
 */
async function batchDeleteAssets() {
    const selected = Array.from(document.querySelectorAll('.asset-checkbox:checked')).map(cb => parseInt(cb.value));
    if (selected.length === 0) {
        showMessage('请先选择要删除的设备', 'warning');
        return;
    }

    if (!confirm(`确定要删除选中的 ${selected.length} 个设备吗？此操作不可恢复！`)) {
        return;
    }

    try {
        const promises = selected.map(id => API.delete(`/assets/${id}/`));
        await Promise.all(promises);

        showMessage(`成功删除 ${selected.length} 个设备`, 'success');
        clearBatchSelection();
        loadAssets();
    } catch (error) {
        console.error('批量删除失败:', error);
        showMessage('批量删除失败: ' + error.message, 'error');
    }
}

/**
 * 填充高级筛选选项
 */
function populateAdvancedFilters(assets) {
    // 获取唯一的工厂、车间、产线、厂商
    const factories = [...new Set(assets.map(a => a.factory).filter(Boolean))];
    const workshops = [...new Set(assets.map(a => a.workshop).filter(Boolean))];
    const lines = [...new Set(assets.map(a => a.line).filter(Boolean))];
    const vendors = [...new Set(assets.map(a => a.vendor).filter(Boolean))];

    populateSelect('filterFactory', factories);
    populateSelect('filterWorkshop', workshops);
    populateSelect('filterLine', lines);
    populateSelect('filterVendor', vendors);
}

/**
 * 填充下拉选项
 */
function populateSelect(id, options) {
    const select = document.getElementById(id);
    select.innerHTML = '<option value="">全部</option>';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
}

/**
 * 应用高级筛选
 */
async function applyAdvancedFilter() {
    const params = { page_size: 1000 };

    const factory = document.getElementById('filterFactory').value;
    const workshop = document.getElementById('filterWorkshop').value;
    const line = document.getElementById('filterLine').value;
    const vendor = document.getElementById('filterVendor').value;
    const criticality = document.getElementById('filterCriticality').value;
    const startDateFrom = document.getElementById('filterStartDateFrom').value;
    const startDateTo = document.getElementById('filterStartDateTo').value;

    if (factory) params.factory = factory;
    if (workshop) params.workshop = workshop;
    if (line) params.line = line;
    if (vendor) params.vendor = vendor;
    if (criticality) params.criticality = criticality;
    if (startDateFrom) params.start_date_after = startDateFrom;
    if (startDateTo) params.start_date_before = startDateTo;

    try {
        const res = await API.getAssets(params);
        renderAssetsTable(res.results || []);
        showMessage(`筛选结果: ${res.results?.length || 0} 条记录`, 'success');
    } catch (error) {
        console.error('筛选失败:', error);
        showMessage('筛选失败: ' + error.message, 'error');
    }
}

/**
 * 重置高级筛选
 */
function resetAdvancedFilter() {
    document.getElementById('filterFactory').value = '';
    document.getElementById('filterWorkshop').value = '';
    document.getElementById('filterLine').value = '';
    document.getElementById('filterVendor').value = '';
    document.getElementById('filterCriticality').value = '';
    document.getElementById('filterStartDateFrom').value = '';
    document.getElementById('filterStartDateTo').value = '';
    loadAssets();
}

/**
 * 显示统计报表
 */
async function showAssetStatistics() {
    try {
        const res = await API.getAssets({ page_size: 1000 });
        const assets = res.results || [];

        // 计算统计数据
        const total = assets.length;
        const active = assets.filter(a => a.status === 'active').length;
        const inactive = assets.filter(a => a.status === 'inactive').length;
        const maintenance = assets.filter(a => a.status === 'maintenance').length;
        const retired = assets.filter(a => a.status === 'retired').length;

        document.getElementById('statTotalCount').textContent = total;
        document.getElementById('statActiveCount').textContent = active;
        document.getElementById('statInactiveCount').textContent = inactive;
        document.getElementById('statMaintenanceCount').textContent = maintenance;

        // 绘制简单的图表（使用纯CSS条形图）
        drawSimpleBarChart('statusChart', {
            '运行中': active,
            '停机': inactive,
            '保养中': maintenance,
            '报废': retired
        });

        const critical = assets.filter(a => a.criticality === 'critical').length;
        const important = assets.filter(a => a.criticality === 'important').length;
        const normal = assets.filter(a => a.criticality === 'normal' || !a.criticality).length;

        drawSimpleBarChart('criticalityChart', {
            '关键': critical,
            '重要': important,
            '一般': normal
        });

        // 位置分布
        const locationMap = {};
        assets.forEach(a => {
            const loc = a.factory || '未分类';
            locationMap[loc] = (locationMap[loc] || 0) + 1;
        });
        drawSimpleBarChart('locationChart', locationMap);

        document.getElementById('statisticsModal').classList.add('show');
    } catch (error) {
        console.error('加载统计数据失败:', error);
        showMessage('加载统计数据失败: ' + error.message, 'error');
    }
}

/**
 * 绘制简单的CSS条形图
 */
function drawSimpleBarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    const entries = Object.entries(data).filter(([_, v]) => v > 0);
    const max = Math.max(...entries.map(([_, v]) => v), 1);

    let html = '<div style="display: flex; align-items: flex-end; gap: 16px; height: 150px;">';
    entries.forEach(([label, value]) => {
        const height = (value / max) * 100;
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 100%; height: ${height}%; background: #4CAF50; border-radius: 4px 4px 0 0; min-height: 20px;"></div>
                <div style="margin-top: 8px; font-size: 12px; text-align: center;">${label}</div>
                <div style="font-size: 11px; color: #666;">${value}</div>
            </div>
        `;
    });
    html += '</div>';

    canvas.outerHTML = `<div id="${canvasId}">${html}</div>`;
}

/**
 * 关闭统计报表模态框
 */
function closeStatisticsModal() {
    document.getElementById('statisticsModal').classList.remove('show');
}

/**
 * 加载工单管理页面
 */
async function loadWorkOrders() {
    const container = document.getElementById('page-workorders');

    // 检查是否是管理员或主管
    const userStr = localStorage.getItem('user');
    let canManage = false;
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            canManage = user.role === 'admin' || user.role === 'supervisor';
        } catch (e) {
            console.error('解析用户信息失败:', e);
        }
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">工单管理</h3>
                <div style="display: flex; gap: 8px;">
                    ${canManage ? `
                        <button class="btn btn-secondary btn-sm" onclick="showWorkOrderImportDialog()">批量导入</button>
                        <button class="btn btn-secondary btn-sm" onclick="exportWorkOrders()">导出列表</button>
                    ` : ''}
                    <button class="btn btn-primary btn-sm" onclick="showWorkOrderModal()">创建工单</button>
                </div>
            </div>
            <div class="card-body">
                <div class="search-bar">
                    <input type="text" id="woSearch" class="form-input search-input" placeholder="搜索工单号、摘要...">
                    <select id="woStatusFilter" class="form-select">
                        <option value="">全部状态</option>
                        <option value="open">待处理</option>
                        <option value="assigned">已分配</option>
                        <option value="in_progress">进行中</option>
                        <option value="completed">已完成</option>
                        <option value="closed">已关闭</option>
                    </select>
                    <button class="btn btn-primary" onclick="searchWorkOrders()">搜索</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>工单号</th>
                                <th>摘要</th>
                                <th>设备</th>
                                <th>类型</th>
                                <th>优先级</th>
                                <th>状态</th>
                                <th>负责人</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="workOrdersTableBody">
                            <tr><td colspan="9" style="text-align: center;">加载中...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 工单新增/编辑模态框 -->
        <div id="woModal" class="modal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="woModalTitle">创建工单</h3>
                    <button class="modal-close" onclick="closeWorkOrderModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="woForm">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">工单编号 (自动生成)</label>
                                <input type="text" id="woCode" class="form-input" placeholder="保存时自动生成" readonly>
                            </div>
                            <div class="form-group">
                                <label class="form-label">设备 <span style="color: red;">*</span></label>
                                <select id="woEquipment" class="form-select" required>
                                    <option value="">请选择设备</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">工单类型</label>
                                <select id="woType" class="form-select">
                                    <option value="CM">纠正性维护(CM)</option>
                                    <option value="PM">预防性维护(PM)</option>
                                    <option value="inspection">点检</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">优先级</label>
                                <select id="woPriority" class="form-select">
                                    <option value="low">低</option>
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                    <option value="critical">紧急</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">摘要 <span style="color: red;">*</span></label>
                            <input type="text" id="woSummary" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">描述</label>
                            <textarea id="woDescription" class="form-textarea" rows="3"></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">负责人</label>
                                <select id="woAssignee" class="form-select">
                                    <option value="">未分配</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">状态</label>
                                <select id="woStatus" class="form-select">
                                    <option value="open">待处理</option>
                                    <option value="assigned">已分配</option>
                                    <option value="in_progress">进行中</option>
                                    <option value="completed">已完成</option>
                                    <option value="closed">已关闭</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">计划开始时间</label>
                                <input type="datetime-local" id="woPlannedStart" class="form-input">
                            </div>
                            <div class="form-group">
                                <label class="form-label">计划结束时间</label>
                                <input type="datetime-local" id="woPlannedEnd" class="form-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">故障代码</label>
                            <input type="text" id="woFailureCode" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">根本原因</label>
                            <textarea id="woRootCause" class="form-textarea" rows="2"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">处理措施</label>
                            <textarea id="woActionsTaken" class="form-textarea" rows="3"></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">停机时间(分钟)</label>
                                <input type="number" id="woDowntimeMinutes" class="form-input" min="0" value="0">
                            </div>
                            <div class="form-group">
                                <label class="form-label">人工工时</label>
                                <input type="number" id="woLaborHours" class="form-input" min="0" step="0.5" value="0">
                            </div>
                            <div class="form-group">
                                <label class="form-label">备件成本</label>
                                <input type="number" id="woPartsCost" class="form-input" min="0" step="0.01" value="0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">备注</label>
                            <textarea id="woNotes" class="form-textarea" rows="2"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeWorkOrderModal()">取消</button>
                    <button class="btn btn-primary" onclick="saveWorkOrder()">保存</button>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await API.getWorkOrders({ page_size: 50, ordering: '-created_at' });
        renderWorkOrdersTable(res.results || []);
    } catch (error) {
        console.error('加载工单列表失败:', error);
        document.getElementById('workOrdersTableBody').innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--danger-color);">加载失败</td></tr>';
    }
}

/**
 * 加载保养计划页面
 */
async function loadMaintenance() {
    const container = document.getElementById('page-maintenance');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">保养计划</h3>
                <button class="btn btn-primary btn-sm" onclick="showMaintenancePlanModal()">创建保养计划</button>
            </div>
            <div class="card-body">
                <div class="search-bar">
                    <input type="text" id="planSearch" class="form-input search-input" placeholder="搜索计划编号、标题...">
                    <select id="planTriggerTypeFilter" class="form-select">
                        <option value="">全部类型</option>
                        <option value="time">时间触发</option>
                        <option value="counter">计数器触发</option>
                    </select>
                    <select id="planIsActiveFilter" class="form-select">
                        <option value="">全部状态</option>
                        <option value="true">启用</option>
                        <option value="false">停用</option>
                    </select>
                    <button class="btn btn-primary" onclick="searchMaintenancePlans()">搜索</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>计划编号</th>
                                <th>设备</th>
                                <th>标题</th>
                                <th>触发类型</th>
                                <th>频率</th>
                                <th>优先级</th>
                                <th>状态</th>
                                <th>上次生成</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="maintenancePlansTableBody">
                            <tr><td colspan="9" style="text-align: center;">加载中...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 保养计划新增/编辑模态框 -->
        <div id="planModal" class="modal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="planModalTitle">创建保养计划</h3>
                    <button class="modal-close" onclick="closeMaintenancePlanModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="planForm">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">计划编号 <span style="color: red;">*</span></label>
                                <input type="text" id="planCode" class="form-input" required placeholder="MP-001">
                            </div>
                            <div class="form-group">
                                <label class="form-label">设备 <span style="color: red;">*</span></label>
                                <select id="planEquipment" class="form-select" required>
                                    <option value="">请选择设备</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">标题 <span style="color: red;">*</span></label>
                            <input type="text" id="planTitle" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">描述</label>
                            <textarea id="planDescription" class="form-textarea" rows="3"></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">触发类型</label>
                                <select id="planTriggerType" class="form-select" onchange="showFrequencyOptions()">
                                    <option value="time">时间触发</option>
                                    <option value="counter">计数器触发</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">优先级</label>
                                <select id="planPriority" class="form-select">
                                    <option value="low">低</option>
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                </select>
                            </div>
                        </div>

                        <!-- 时间触发选项 -->
                        <div id="timeBasedOptions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">频率值</label>
                                <input type="number" id="planFrequencyValue" class="form-input" min="1" placeholder="例如: 1, 2, 3">
                            </div>
                            <div class="form-group">
                                <label class="form-label">频率单位</label>
                                <select id="planFrequencyUnit" class="form-select">
                                    <option value="day">天</option>
                                    <option value="week">周</option>
                                    <option value="month">月</option>
                                    <option value="quarter">季度</option>
                                    <option value="year">年</option>
                                </select>
                            </div>
                        </div>

                        <!-- 计数器触发选项 -->
                        <div id="counterBasedOptions" style="display: none; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">计数器名称</label>
                                <input type="text" id="planCounterName" class="form-input" placeholder="例如: 运行小时数、生产数量">
                            </div>
                            <div class="form-group">
                                <label class="form-label">阈值</label>
                                <input type="number" id="planCounterThreshold" class="form-input" step="0.01" placeholder="触发保养的计数器值">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">预估工时(小时)</label>
                                <input type="number" id="planEstimatedHours" class="form-input" min="0" step="0.5">
                            </div>
                            <div class="form-group">
                                <label class="form-label">预估成本</label>
                                <input type="number" id="planEstimatedCost" class="form-input" min="0" step="0.01">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">所需技能</label>
                            <input type="text" id="planRequiredSkills" class="form-input" placeholder="例如: 电工, 机械师">
                        </div>

                        <div class="form-group">
                            <label class="form-label">检查清单模板 (JSON数组)</label>
                            <textarea id="planChecklistTemplate" class="form-textarea" rows="4" placeholder='["检查项1", "检查项2", "检查项3"]'></textarea>
                            <small style="color: var(--gray-500);">JSON数组格式，例如：["检查机油", "检查皮带", "清洁滤网"]</small>
                        </div>

                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="planIsActive">
                                <span>启用此计划</span>
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeMaintenancePlanModal()">取消</button>
                    <button class="btn btn-primary" onclick="saveMaintenancePlan()">保存</button>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await API.getMaintenancePlans({ page_size: 50 });
        renderMaintenancePlansTable(res.results || []);
    } catch (error) {
        console.error('加载保养计划列表失败:', error);
        document.getElementById('maintenancePlansTableBody').innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--danger-color);">加载失败</td></tr>';
    }
}

/**
 * 加载点检记录页面
 */
function loadInspections() {
    const container = document.getElementById('page-inspections');
    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div style="text-align: center; padding: 40px;">
                    <h3 style="color: var(--gray-600);">点检记录模块</h3>
                    <p style="color: var(--gray-500);">功能开发中...</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * 加载备件管理页面
 */
async function loadSpareParts() {
    const container = document.getElementById('page-spareparts');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">备件管理</h3>
                <button class="btn btn-primary btn-sm" onclick="showSparePartModal()">新增备件</button>
            </div>
            <div class="card-body">
                <div class="search-bar">
                    <input type="text" id="partSearch" class="form-input search-input" placeholder="搜索备件名称、编码...">
                    <button class="btn btn-primary" onclick="searchSpareParts()">搜索</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>备件编码</th>
                                <th>备件名称</th>
                                <th>规格</th>
                                <th>单位</th>
                                <th>当前库存</th>
                                <th>最小库存</th>
                                <th>安全库存</th>
                                <th>位置</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="sparePartsTableBody">
                            <tr><td colspan="9" style="text-align: center;">加载中...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await API.getSpareParts({ page_size: 50 });
        renderSparePartsTable(res.results || []);
    } catch (error) {
        console.error('加载备件列表失败:', error);
        document.getElementById('sparePartsTableBody').innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--danger-color);">加载失败</td></tr>';
    }
}

/**
 * 渲染备件表格
 */
function renderSparePartsTable(parts) {
    const tbody = document.getElementById('sparePartsTableBody');

    if (!parts || parts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--gray-500);">暂无备件</td></tr>';
        return;
    }

    tbody.innerHTML = parts.map(part => {
        const isLowStock = part.current_stock <= part.min_stock;
        return `
            <tr style="${isLowStock ? 'background-color: #fef3c7;' : ''}">
                <td>${part.part_code || '-'}</td>
                <td>${part.name || '-'}</td>
                <td>${part.spec || '-'}</td>
                <td>${part.unit || '-'}</td>
                <td style="${isLowStock ? 'color: var(--danger-color); font-weight: 600;' : ''}">${part.current_stock || 0}</td>
                <td>${part.min_stock || 0}</td>
                <td>${part.safety_stock || 0}</td>
                <td>${part.location || '-'}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="stockInPart(${part.id})">入库</button>
                    <button class="btn btn-warning btn-sm" onclick="stockOutPart(${part.id})">出库</button>
                    <button class="btn btn-secondary btn-sm" onclick="editSparePart(${part.id})">编辑</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 加载报表统计页面
 */
function loadReports() {
    const container = document.getElementById('page-reports');
    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div style="text-align: center; padding: 40px;">
                    <h3 style="color: var(--gray-600);">报表统计模块</h3>
                    <p style="color: var(--gray-500);">功能开发中...</p>
                </div>
            </div>
        </div>
    `;
}

// ========== 工具函数 ==========

/**
 * 渲染优先级标签
 */
function renderPriorityBadge(priority) {
    const badges = {
        'low': '<span class="badge badge-info">低</span>',
        'medium': '<span class="badge badge-warning">中</span>',
        'high': '<span class="badge badge-danger">高</span>'
    };
    return badges[priority] || '<span class="badge badge-secondary">-</span>';
}

/**
 * 渲染状态标签
 */
function renderStatusBadge(status) {
    const badges = {
        'open': '<span class="badge badge-secondary">待处理</span>',
        'assigned': '<span class="badge badge-info">已分配</span>',
        'in_progress': '<span class="badge badge-primary">进行中</span>',
        'completed': '<span class="badge badge-success">已完成</span>',
        'closed': '<span class="badge badge-secondary">已关闭</span>',
        'canceled': '<span class="badge badge-danger">已取消</span>',
        'active': '<span class="badge badge-success">运行中</span>',
        'inactive': '<span class="badge badge-warning">停机</span>',
        'retired': '<span class="badge badge-danger">报废</span>'
    };
    return badges[status] || `<span class="badge badge-secondary">${status}</span>`;
}

/**
 * 渲染设备状态标签
 */
function renderAssetStatusBadge(status) {
    return renderStatusBadge(status);
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 显示消息提示
 */
function showMessage(message, type = 'success') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 250px;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(messageEl);

    // 3秒后移除
    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

// ========== 搜索功能 ==========

/**
 * 搜索设备
 */
async function searchAssets() {
    const search = document.getElementById('assetSearch').value;
    const status = document.getElementById('assetStatusFilter').value;

    try {
        const params = { page_size: 50 };
        if (search) params.search = search;
        if (status) params.status = status;

        const res = await API.getAssets(params);
        renderAssetsTable(res.results || []);
    } catch (error) {
        console.error('搜索设备失败:', error);
        showMessage('搜索失败', 'error');
    }
}

/**
 * 搜索备件
 */
async function searchSpareParts() {
    const search = document.getElementById('partSearch').value;

    try {
        const params = { page_size: 50 };
        if (search) params.search = search;

        const res = await API.getSpareParts(params);
        renderSparePartsTable(res.results || []);
    } catch (error) {
        console.error('搜索备件失败:', error);
        showMessage('搜索失败', 'error');
    }
}
