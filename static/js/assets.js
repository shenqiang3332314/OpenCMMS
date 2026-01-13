/**
 * 设备台账管理模块
 */

let currentEditingAssetId = null;
let allAssets = [];

// 分页相关变量
let currentPage = 1;
let pageSize = 50; // 默认显示50条，而不是20条
let filteredAssets = []; // 当前筛选后的数据

/**
 * 加载设备数据
 */
async function loadAssets() {
    try {
        const res = await API.getAssets({ page_size: 1000 });
        renderAssetsTable(res.results || []);
        populateAdvancedFilters(res.results || []);
    } catch (error) {
        console.error('加载设备数据失败:', error);
        showAssetMessage('加载设备数据失败: ' + error.message, 'error');
        renderAssetsTable([]);
    }
}

/**
 * 检查用户是否是管理员
 */
function isAdmin() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    try {
        const user = JSON.parse(userStr);
        return user.role === 'admin';
    } catch (e) {
        return false;
    }
}

/**
 * 渲染设备表格（支持分页）
 */
function renderAssetsTable(assets) {
    allAssets = assets || [];
    filteredAssets = allAssets; // 默认显示全部
    currentPage = 1; // 重置到第一页
    
    // 更新设备总数显示
    const countBadge = document.getElementById('assetCountBadge');
    if (countBadge) {
        countBadge.textContent = `共${allAssets.length}台`;
    }
    
    renderPage();
}

/**
 * 渲染当前页数据
 */
function renderPage() {
    const tbody = document.getElementById('assetsTableBody');
    const admin = isAdmin();

    if (!filteredAssets || filteredAssets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--gray-500);">暂无设备</td></tr>';
        updatePaginationInfo(0);
        return;
    }

    // 计算当前页的数据
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredAssets.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(asset => `
        <tr>
            <td><input type="checkbox" class="asset-checkbox" value="${asset.id}" onchange="updateSelectedCount()"></td>
            <td>${asset.code || '-'}</td>
            <td>${asset.name || '-'}</td>
            <td>${asset.location_display || '-'}</td>
            <td>${asset.vendor || '-'}</td>
            <td>${renderAssetStatusBadge(asset.status)}</td>
            <td>${formatDate(asset.start_date)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewAssetDetails(${asset.id})">查看</button>
                ${admin ? `
                    <button class="btn btn-secondary btn-sm" onclick="editAssetModal(${asset.id})">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteAsset(${asset.id})">删除</button>
                ` : ''}
            </td>
        </tr>
    `).join('');

    // 更新分页信息
    updatePaginationInfo(filteredAssets.length);
}

/**
 * 更新分页信息显示
 */
function updatePaginationInfo(total) {
    const totalPages = Math.ceil(total / pageSize) || 1;
    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);

    document.getElementById('paginationStart').textContent = start;
    document.getElementById('paginationEnd').textContent = end;
    document.getElementById('paginationTotal').textContent = total;

    // 如果有多页数据，显示更明显的提示
    if (totalPages > 1) {
        const paginationDiv = document.getElementById('assetsPagination');
        paginationDiv.style.background = '#f0f8ff';
        paginationDiv.style.border = '1px solid #007bff';
        paginationDiv.style.borderRadius = '4px';
        paginationDiv.style.padding = '16px';
        
        // 添加提示文字
        const existingTip = document.getElementById('paginationTip');
        if (!existingTip && totalPages > 1) {
            const tip = document.createElement('div');
            tip.id = 'paginationTip';
            tip.style.cssText = 'color: #007bff; font-weight: bold; font-size: 14px; margin-bottom: 8px;';
            tip.textContent = `提示：共有 ${total} 条设备记录，分为 ${totalPages} 页显示`;
            paginationDiv.insertBefore(tip, paginationDiv.firstChild);
        }
    } else {
        // 如果只有一页，移除特殊样式
        const paginationDiv = document.getElementById('assetsPagination');
        paginationDiv.style.background = '';
        paginationDiv.style.border = '';
        paginationDiv.style.borderRadius = '';
        paginationDiv.style.padding = '16px 0';
        
        const existingTip = document.getElementById('paginationTip');
        if (existingTip) {
            existingTip.remove();
        }
    }

    // 更新按钮状态
    document.getElementById('paginationFirstBtn').disabled = currentPage === 1;
    document.getElementById('paginationPrevBtn').disabled = currentPage === 1;
    document.getElementById('paginationNextBtn').disabled = currentPage === totalPages;
    document.getElementById('paginationLastBtn').disabled = currentPage === totalPages;

    // 渲染页码
    renderPageNumbers(totalPages);
}

/**
 * 渲染页码按钮
 */
function renderPageNumbers(totalPages) {
    const container = document.getElementById('paginationNumbers');
    const maxButtons = 7; // 最多显示7个页码按钮

    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    let html = '';
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage ? 'btn-primary' : 'btn-secondary';
        html += `<button class="btn btn-sm ${isActive}" onclick="goToPage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

/**
 * 跳转到指定页
 */
function goToPage(page) {
    const totalPages = Math.ceil(filteredAssets.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderPage();
}

/**
 * 首页
 */
function goToFirstPage() {
    goToPage(1);
}

/**
 * 上一页
 */
function goToPrevPage() {
    goToPage(currentPage - 1);
}

/**
 * 下一页
 */
function goToNextPage() {
    goToPage(currentPage + 1);
}

/**
 * 末页
 */
function goToLastPage() {
    const totalPages = Math.ceil(filteredAssets.length / pageSize) || 1;
    goToPage(totalPages);
}

/**
 * 修改每页显示数量
 */
function changePageSize() {
    const newPageSize = document.getElementById('pageSizeSelect').value;
    
    if (newPageSize === 'all') {
        // 显示全部
        pageSize = filteredAssets.length || 1000;
        currentPage = 1;
    } else {
        pageSize = parseInt(newPageSize);
        currentPage = 1; // 重置到第一页
    }
    
    renderPage();
}

/**
 * 显示新增设备模态框
 */
function showAssetModal() {
    if (!isAdmin()) {
        showAssetMessage('只有管理员可以新增设备', 'error');
        return;
    }

    currentEditingAssetId = null;

    // 更新模态框标题
    document.getElementById('assetModalTitle').textContent = '新增设备';

    // 重置表单
    document.getElementById('assetForm').reset();

    // 设置默认值
    document.getElementById('assetStatus').value = 'active';
    document.getElementById('assetCriticality').value = 'normal';

    // 显示模态框
    document.getElementById('assetModal').classList.add('show');
}

/**
 * 显示编辑设备模态框
 */
async function editAssetModal(id) {
    if (!isAdmin()) {
        showAssetMessage('只有管理员可以编辑设备', 'error');
        return;
    }

    currentEditingAssetId = id;

    // 更新模态框标题
    document.getElementById('assetModalTitle').textContent = '编辑设备';

    try {
        const asset = await API.getAsset(id);

        // 填充表单
        document.getElementById('assetCode').value = asset.code || '';
        document.getElementById('assetName').value = asset.name || '';
        document.getElementById('assetProcess').value = asset.process || '';
        document.getElementById('assetEquipmentId').value = asset.equipment_id || '';
        document.getElementById('assetMachineName').value = asset.machine_name || '';
        document.getElementById('assetFactory').value = asset.factory || '';
        document.getElementById('assetWorkshop').value = asset.workshop || '';
        document.getElementById('assetLine').value = asset.line || '';
        document.getElementById('assetStation').value = asset.station || '';
        document.getElementById('assetVendor').value = asset.vendor || '';
        document.getElementById('assetModel').value = asset.model || '';
        document.getElementById('assetSerialNumber').value = asset.serial_number || '';
        document.getElementById('assetSpecification').value = asset.specification || '';
        document.getElementById('assetStartDate').value = asset.start_date || '';
        document.getElementById('assetWarrantyExpiry').value = asset.warranty_expiry || '';
        document.getElementById('assetStatus').value = asset.status || 'active';
        document.getElementById('assetCriticality').value = asset.criticality || 'normal';
        document.getElementById('assetCostCenter').value = asset.cost_center || '';
        document.getElementById('assetValue').value = asset.asset_value || '';
        document.getElementById('assetExpectedLife').value = asset.expected_life_years || '';
        document.getElementById('assetMeterReading').value = asset.current_meter_reading || '';
        document.getElementById('assetMeterUnit').value = asset.meter_unit || '';
        document.getElementById('assetNotes').value = asset.notes || '';

        // 显示模态框
        document.getElementById('assetModal').classList.add('show');

    } catch (error) {
        console.error('获取设备信息失败:', error);
        showAssetMessage('获取设备信息失败: ' + error.message, 'error');
    }
}

/**
 * 保存设备（新增或编辑）
 */
async function saveAsset() {
    const form = document.getElementById('assetForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const data = {
        code: document.getElementById('assetCode').value.trim(),
        name: document.getElementById('assetName').value.trim(),
        process: document.getElementById('assetProcess').value.trim(),
        equipment_id: document.getElementById('assetEquipmentId').value.trim(),
        machine_name: document.getElementById('assetMachineName').value.trim(),
        factory: document.getElementById('assetFactory').value.trim(),
        workshop: document.getElementById('assetWorkshop').value.trim(),
        line: document.getElementById('assetLine').value.trim(),
        station: document.getElementById('assetStation').value.trim(),
        vendor: document.getElementById('assetVendor').value.trim(),
        model: document.getElementById('assetModel').value.trim(),
        serial_number: document.getElementById('assetSerialNumber').value.trim(),
        specification: document.getElementById('assetSpecification').value.trim(),
        start_date: document.getElementById('assetStartDate').value || null,
        warranty_expiry: document.getElementById('assetWarrantyExpiry').value || null,
        status: document.getElementById('assetStatus').value,
        criticality: document.getElementById('assetCriticality').value,
        cost_center: document.getElementById('assetCostCenter').value.trim(),
        asset_value: document.getElementById('assetValue').value || null,
        expected_life_years: document.getElementById('assetExpectedLife').value || null,
        current_meter_reading: document.getElementById('assetMeterReading').value || 0,
        meter_unit: document.getElementById('assetMeterUnit').value.trim(),
        notes: document.getElementById('assetNotes').value.trim(),
    };

    // 清理空值
    Object.keys(data).forEach(key => {
        if (data[key] === '') {
            if (['asset_value', 'expected_life_years', 'current_meter_reading'].includes(key)) {
                data[key] = null;
            } else {
                data[key] = null;
            }
        }
    });

    try {
        if (currentEditingAssetId) {
            // 编辑
            await API.updateAsset(currentEditingAssetId, data);
            showAssetMessage('设备更新成功', 'success');
        } else {
            // 新增
            await API.createAsset(data);
            showAssetMessage('设备创建成功', 'success');
        }

        // 关闭模态框
        closeAssetModal();

        // 重新加载列表
        loadAssets();

    } catch (error) {
        console.error('保存设备失败:', error);
        showAssetMessage('保存失败: ' + error.message, 'error');
    }
}

/**
 * 关闭设备模态框
 */
function closeAssetModal() {
    document.getElementById('assetModal').classList.remove('show');
    currentEditingAssetId = null;
}

/**
 * 查看设备详情
 */
async function viewAssetDetails(id) {
    try {
        const asset = await API.getAsset(id);

        // 创建详情HTML
        const detailsHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">设备详情 - ${asset.code}</h3>
                    <button class="btn btn-secondary btn-sm" onclick="this.closest('.card').remove()">关闭</button>
                </div>
                <div class="card-body">
                    <table style="width: 100%;">
                        <tr><td style="padding: 8px; font-weight: 600;">设备编码:</td><td style="padding: 8px;">${asset.code || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">设备名称:</td><td style="padding: 8px;">${asset.name || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">工序:</td><td style="padding: 8px;">${asset.process || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">设备ID:</td><td style="padding: 8px;">${asset.equipment_id || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">位置:</td><td style="padding: 8px;">${asset.location_display || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">厂商:</td><td style="padding: 8px;">${asset.vendor || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">型号:</td><td style="padding: 8px;">${asset.model || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">序列号:</td><td style="padding: 8px;">${asset.serial_number || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">状态:</td><td style="padding: 8px;">${renderAssetStatusBadge(asset.status)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">重要性:</td><td style="padding: 8px;">${asset.criticality || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">启用日期:</td><td style="padding: 8px;">${formatDate(asset.start_date)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">保修到期:</td><td style="padding: 8px;">${formatDate(asset.warranty_expiry)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">当前读数:</td><td style="padding: 8px;">${asset.current_meter_reading || 0} ${asset.meter_unit || ''}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">上次保养:</td><td style="padding: 8px;">${formatDate(asset.last_maintenance_date)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">下次保养:</td><td style="padding: 8px;">${formatDate(asset.next_maintenance_date)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">规格说明:</td><td style="padding: 8px;">${asset.specification || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">备注:</td><td style="padding: 8px;">${asset.notes || '-'}</td></tr>
                    </table>
                </div>
            </div>
        `;

        // 替换页面内容
        const container = document.getElementById('page-assets');
        const originalContent = container.innerHTML;
        container.innerHTML = detailsHTML;

        // 保存原始内容以便恢复
        container.dataset.originalContent = originalContent;

    } catch (error) {
        console.error('获取设备详情失败:', error);
        showAssetMessage('获取设备详情失败: ' + error.message, 'error');
    }
}

/**
 * 删除设备
 */
async function deleteAsset(id) {
    if (!isAdmin()) {
        showAssetMessage('只有管理员可以删除设备', 'error');
        return;
    }

    const asset = allAssets.find(a => a.id === id);
    if (!asset) return;

    if (!confirm(`确定要删除设备 "${asset.code} - ${asset.name}" 吗？`)) {
        return;
    }

    try {
        await API.deleteAsset(id);
        showAssetMessage('设备删除成功', 'success');
        loadAssets();
    } catch (error) {
        console.error('删除设备失败:', error);
        showAssetMessage('删除失败: ' + error.message, 'error');
    }
}

/**
 * 渲染设备状态标签
 */
function renderAssetStatusBadge(status) {
    const badges = {
        'active': '<span class="badge badge-success">运行中</span>',
        'inactive': '<span class="badge badge-warning">停机</span>',
        'retired': '<span class="badge badge-danger">报废</span>',
        'maintenance': '<span class="badge badge-info">保养中</span>'
    };
    return badges[status] || `<span class="badge badge-secondary">${status}</span>`;
}

/**
 * 显示消息提示
 */
function showAssetMessage(message, type = 'success') {
    // 使用全局showMessage函数（如果在index.js中定义）
    if (typeof showMessage !== 'undefined' && showMessage) {
        showMessage(message, type);
    } else {
        // 备用实现
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
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }
}

/**
 * 搜索设备（支持分页）
 */
async function searchAssets() {
    const search = document.getElementById('assetSearch').value;
    const status = document.getElementById('assetStatusFilter').value;

    try {
        // 获取所有数据进行前端筛选和分页
        const res = await API.getAssets({ page_size: 1000 });
        let results = res.results || [];

        // 前端筛选
        if (search) {
            const searchLower = search.toLowerCase();
            results = results.filter(a =>
                (a.code && a.code.toLowerCase().includes(searchLower)) ||
                (a.name && a.name.toLowerCase().includes(searchLower))
            );
        }
        if (status) {
            results = results.filter(a => a.status === status);
        }

        filteredAssets = results;
        currentPage = 1;
        
        // 更新设备总数显示
        const countBadge = document.getElementById('assetCountBadge');
        if (countBadge) {
            if (search || status) {
                countBadge.textContent = `筛选出${results.length}台/共${allAssets.length}台`;
            } else {
                countBadge.textContent = `共${allAssets.length}台`;
            }
        }
        
        renderPage();
        populateAdvancedFilters(allAssets); // 更新筛选选项
    } catch (error) {
        console.error('搜索设备失败:', error);
        showAssetMessage('搜索失败', 'error');
    }
}

/**
 * 上传设备导入文件
 */
async function uploadAssetFile(input) {
    const file = input.files[0];
    if (!file) {
        return;
    }

    // 显示加载提示
    showAssetMessage('正在导入，请稍候...', 'info');

    try {
        const result = await API.importAssets(file);

        // 显示导入结果
        if (result.success_count > 0) {
            showAssetMessage(result.message, 'success');

            // 重新加载设备列表
            loadAssets();

            // 如果有错误，显示详情
            if (result.error_count > 0 && result.errors.length > 0) {
                setTimeout(() => {
                    alert('导入完成，但有部分失败:\n\n' + result.errors.join('\n'));
                }, 500);
            }
        } else {
            showAssetMessage(result.message, 'error');
            if (result.errors.length > 0) {
                alert('导入失败:\n\n' + result.errors.join('\n'));
            }
        }
    } catch (error) {
        console.error('导入失败:', error);
        showAssetMessage('导入失败: ' + error.message, 'error');
    }

    // 清空文件选择，允许重复选择同一文件
    input.value = '';
}

/**
 * 切换批量操作区域显示
 */
function toggleBatchActions() {
    const area = document.getElementById('batchActionsArea');
    if (area) {
        area.style.display = area.style.display === 'none' ? 'flex' : 'none';
    }
}

/**
 * 从外部系统同步设备数据
 */
function syncAssetsFromExternal() {
    showAssetMessage('数据同步功能开发中...', 'info');
}

/**
 * 切换高级筛选区域显示
 */
function toggleAdvancedFilter() {
    const area = document.getElementById('advancedFilterArea');
    if (area) {
        area.style.display = area.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * 显示设备统计报表
 */
function showAssetStatistics() {
    const modal = document.getElementById('assetStatisticsModal');
    if (modal) {
        modal.classList.add('show');
        loadAssetStatistics();
    }
}

/**
 * 加载设备统计数据
 */
async function loadAssetStatistics() {
    try {
        const res = await API.getAssets({ page_size: 1000 });
        const assets = res.results || [];
        
        // 计算统计数据
        const stats = {
            total: assets.length,
            active: assets.filter(a => a.status === 'active').length,
            inactive: assets.filter(a => a.status === 'inactive').length,
            maintenance: assets.filter(a => a.status === 'maintenance').length,
            retired: assets.filter(a => a.status === 'retired').length,
            critical: assets.filter(a => a.criticality === 'critical').length,
            important: assets.filter(a => a.criticality === 'important').length,
            normal: assets.filter(a => a.criticality === 'normal').length
        };
        
        // 更新统计显示
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statActive').textContent = stats.active;
        document.getElementById('statInactive').textContent = stats.inactive;
        document.getElementById('statMaintenance').textContent = stats.maintenance;
        document.getElementById('statRetired').textContent = stats.retired;
        document.getElementById('statCritical').textContent = stats.critical;
        document.getElementById('statImportant').textContent = stats.important;
        document.getElementById('statNormal').textContent = stats.normal;
        
    } catch (error) {
        console.error('加载统计数据失败:', error);
        showAssetMessage('加载统计数据失败: ' + error.message, 'error');
    }
}

/**
 * 更新选中数量显示
 */
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.asset-checkbox:checked');
    const count = checkboxes.length;
    const selectedCountEl = document.getElementById('selectedCount');
    const batchArea = document.getElementById('batchActionsArea');
    
    if (selectedCountEl) {
        selectedCountEl.textContent = count;
    }
    
    if (batchArea) {
        batchArea.style.display = count > 0 ? 'flex' : 'none';
    }
}

/**
 * 切换全选
 */
function toggleSelectAll(checkbox) {
    const assetCheckboxes = document.querySelectorAll('.asset-checkbox');
    assetCheckboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateSelectedCount();
}

/**
 * 批量编辑设备
 */
function batchEditAssets() {
    showAssetMessage('批量编辑功能开发中...', 'info');
}

/**
 * 批量修改状态
 */
function batchUpdateStatus() {
    showAssetMessage('批量修改状态功能开发中...', 'info');
}

/**
 * 批量删除设备
 */
function batchDeleteAssets() {
    const checkboxes = document.querySelectorAll('.asset-checkbox:checked');
    if (checkboxes.length === 0) {
        showAssetMessage('请先选择要删除的设备', 'error');
        return;
    }
    
    if (confirm(`确定要删除选中的 ${checkboxes.length} 个设备吗？`)) {
        showAssetMessage('批量删除功能开发中...', 'info');
    }
}

/**
 * 清除批量选择
 */
function clearBatchSelection() {
    const checkboxes = document.querySelectorAll('.asset-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    document.getElementById('selectAllAssets').checked = false;
    updateSelectedCount();
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('zh-CN');
    } catch (e) {
        return dateStr;
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
    if (!select) return;
    
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
function applyAdvancedFilter() {
    const factory = document.getElementById('filterFactory').value;
    const workshop = document.getElementById('filterWorkshop').value;
    const line = document.getElementById('filterLine').value;
    const vendor = document.getElementById('filterVendor').value;
    const criticality = document.getElementById('filterCriticality').value;
    const startDateFrom = document.getElementById('filterStartDateFrom').value;
    const startDateTo = document.getElementById('filterStartDateTo').value;

    let results = [...allAssets];

    // 应用各种筛选条件
    if (factory) {
        results = results.filter(a => a.factory === factory);
    }
    if (workshop) {
        results = results.filter(a => a.workshop === workshop);
    }
    if (line) {
        results = results.filter(a => a.line === line);
    }
    if (vendor) {
        results = results.filter(a => a.vendor === vendor);
    }
    if (criticality) {
        results = results.filter(a => a.criticality === criticality);
    }
    if (startDateFrom) {
        results = results.filter(a => a.start_date && a.start_date >= startDateFrom);
    }
    if (startDateTo) {
        results = results.filter(a => a.start_date && a.start_date <= startDateTo);
    }

    filteredAssets = results;
    currentPage = 1;
    
    // 更新设备总数显示
    const countBadge = document.getElementById('assetCountBadge');
    if (countBadge) {
        if (results.length !== allAssets.length) {
            countBadge.textContent = `筛选出${results.length}台/共${allAssets.length}台`;
        } else {
            countBadge.textContent = `共${allAssets.length}台`;
        }
    }
    
    renderPage();
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
    
    // 重置基础搜索
    document.getElementById('assetSearch').value = '';
    document.getElementById('assetStatusFilter').value = '';
    
    // 显示全部数据
    filteredAssets = allAssets;
    currentPage = 1;
    
    // 更新设备总数显示
    const countBadge = document.getElementById('assetCountBadge');
    if (countBadge) {
        countBadge.textContent = `共${allAssets.length}台`;
    }
    
    renderPage();
}
/**
 * 下载设备导入模板
 */
async function downloadAssetTemplate() {
    try {
        showAssetMessage('正在下载模板...', 'info');
        await API.downloadAssetTemplate();
        showAssetMessage('模板下载成功', 'success');
    } catch (error) {
        console.error('下载模板失败:', error);
        showAssetMessage('下载模板失败: ' + error.message, 'error');
        
        // 如果是认证错误，提示用户登录
        if (error.message.includes('登录')) {
            setTimeout(() => {
                if (confirm('需要重新登录，是否跳转到登录页面？')) {
                    window.location.href = '/static/login.html';
                }
            }, 1000);
        }
    }
}

/**
 * 导出设备台账数据
 */
async function exportAssetData() {
    try {
        showAssetMessage('正在导出数据...', 'info');
        await API.exportAssets();
        showAssetMessage('数据导出成功', 'success');
    } catch (error) {
        console.error('导出数据失败:', error);
        showAssetMessage('导出数据失败: ' + error.message, 'error');
        
        // 如果是认证错误，提示用户登录
        if (error.message.includes('登录')) {
            setTimeout(() => {
                if (confirm('需要重新登录，是否跳转到登录页面？')) {
                    window.location.href = '/static/login.html';
                }
            }, 1000);
        }
    }
}