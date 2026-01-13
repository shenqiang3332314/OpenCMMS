/**
 * 工单管理模块
 */

let currentEditingWorkOrderId = null;
let allWorkOrdersList = [];
let availableAssets = [];
let availableUsers = [];

/**
 * 检查用户是否可以管理工单
 */
function canManageWorkOrders() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    try {
        const user = JSON.parse(userStr);
        return user.role === 'admin' || user.role === 'supervisor';
    } catch (e) {
        return false;
    }
}

/**
 * 加载设备和用户列表
 */
async function loadAssetsAndUsers() {
    try {
        const [assetsRes, usersRes] = await Promise.all([
            API.getAssets({ page_size: 1000 }),
            API.get('/auth/users/', { page_size: 1000 })
        ]);
        availableAssets = assetsRes.results || [];
        availableUsers = usersRes.results || [];

        console.log('加载设备列表:', availableAssets.length, '个设备');
        console.log('加载用户列表:', availableUsers.length, '个用户');

        if (availableAssets.length === 0) {
            showWorkOrderMessage('警告：没有可用的设备，请先创建设备', 'warning');
        }
    } catch (error) {
        console.error('加载设备和用户列表失败:', error);
        showWorkOrderMessage('加载数据失败: ' + error.message + '。请确保已登录并且有权限访问', 'error');
        // 即使失败也初始化空数组，避免后续错误
        availableAssets = [];
        availableUsers = [];
    }
}

/**
 * 显示创建工单模态框
 */
async function showWorkOrderModal() {
    if (!canManageWorkOrders()) {
        showWorkOrderMessage('只有管理员和主管可以创建工单', 'error');
        return;
    }

    currentEditingWorkOrderId = null;

    // 更新模态框标题
    document.getElementById('woModalTitle').textContent = '创建工单';

    // 重置表单
    document.getElementById('woForm').reset();

    // 加载设备和用户列表
    await loadAssetsAndUsers();

    // 填充设备和用户下拉列表
    populateAssetSelect();
    populateUserSelect();

    // 设置默认值
    document.getElementById('woType').value = 'CM';
    document.getElementById('woPriority').value = 'medium';
    document.getElementById('woStatus').value = 'open';

    // 显示模态框
    document.getElementById('woModal').classList.add('show');
}

/**
 * 填充设备下拉列表
 */
function populateAssetSelect() {
    const select = document.getElementById('woEquipment');
    select.innerHTML = '<option value="">请选择设备</option>';
    availableAssets.forEach(asset => {
        const option = document.createElement('option');
        option.value = asset.id;
        option.textContent = `${asset.code} - ${asset.name}`;
        select.appendChild(option);
    });
}

/**
 * 填充用户下拉列表
 */
function populateUserSelect() {
    const select = document.getElementById('woAssignee');
    select.innerHTML = '<option value="">未分配</option>';
    availableUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.full_name || user.username} (${user.role_display || user.role})`;
        select.appendChild(option);
    });
}

/**
 * 显示编辑工单模态框
 */
async function editWorkOrderModal(id) {
    if (!canManageWorkOrders()) {
        showWorkOrderMessage('只有管理员和主管可以编辑工单', 'error');
        return;
    }

    currentEditingWorkOrderId = id;

    // 加载设备和用户列表
    await loadAssetsAndUsers();

    // 更新模态框标题
    document.getElementById('woModalTitle').textContent = '编辑工单';

    try {
        const wo = await API.getWorkOrder(id);

        // 填充下拉列表
        populateAssetSelect();
        populateUserSelect();

        // 填充表单
        document.getElementById('woCode').value = wo.wo_code || '';
        document.getElementById('woEquipment').value = wo.equipment || '';
        document.getElementById('woType').value = wo.wo_type || 'CM';
        document.getElementById('woStatus').value = wo.status || 'open';
        document.getElementById('woSummary').value = wo.summary || '';
        document.getElementById('woDescription').value = wo.description || '';
        document.getElementById('woPriority').value = wo.priority || 'medium';
        document.getElementById('woAssignee').value = wo.assignee || '';
        document.getElementById('woPlannedStart').value = wo.planned_start || '';
        document.getElementById('woPlannedEnd').value = wo.planned_end || '';
        document.getElementById('woFailureCode').value = wo.failure_code || '';
        document.getElementById('woRootCause').value = wo.root_cause || '';
        document.getElementById('woActionsTaken').value = wo.actions_taken || '';
        document.getElementById('woDowntimeMinutes').value = wo.downtime_minutes || 0;
        document.getElementById('woLaborHours').value = wo.labor_hours || 0;
        document.getElementById('woPartsCost').value = wo.parts_cost || 0;
        document.getElementById('woNotes').value = wo.notes || '';

        // 显示模态框
        document.getElementById('woModal').classList.add('show');

    } catch (error) {
        console.error('获取工单信息失败:', error);
        showWorkOrderMessage('获取工单信息失败: ' + error.message, 'error');
    }
}

/**
 * 保存工单（新增或编辑）
 */
async function saveWorkOrder() {
    const form = document.getElementById('woForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const data = {
        equipment: document.getElementById('woEquipment').value || null,
        wo_type: document.getElementById('woType').value,
        status: document.getElementById('woStatus').value,
        summary: document.getElementById('woSummary').value.trim(),
        description: document.getElementById('woDescription').value.trim(),
        priority: document.getElementById('woPriority').value,
        assignee: document.getElementById('woAssignee').value || null,
        planned_start: document.getElementById('woPlannedStart').value || null,
        planned_end: document.getElementById('woPlannedEnd').value || null,
        failure_code: document.getElementById('woFailureCode').value.trim(),
        root_cause: document.getElementById('woRootCause').value.trim(),
        actions_taken: document.getElementById('woActionsTaken').value.trim(),
        downtime_minutes: document.getElementById('woDowntimeMinutes').value || 0,
        labor_hours: document.getElementById('woLaborHours').value || 0,
        parts_cost: document.getElementById('woPartsCost').value || 0,
        notes: document.getElementById('woNotes').value.trim(),
    };

    // 编辑时才包含工单号
    if (currentEditingWorkOrderId) {
        data.wo_code = document.getElementById('woCode').value.trim();
    }

    // 清理空值
    Object.keys(data).forEach(key => {
        if (data[key] === '') {
            data[key] = null;
        }
    });

    console.log('保存工单数据:', data);

    try {
        if (currentEditingWorkOrderId) {
            // 编辑
            await API.updateWorkOrder(currentEditingWorkOrderId, data);
            showWorkOrderMessage('工单更新成功', 'success');
        } else {
            // 新增
            console.log('创建新工单...');
            const result = await API.createWorkOrder(data);
            console.log('工单创建成功:', result);
            showWorkOrderMessage('工单创建成功', 'success');
        }

        // 关闭模态框
        closeWorkOrderModal();

        // 重新加载列表
        loadWorkOrders();

    } catch (error) {
        console.error('保存工单失败:', error);
        showWorkOrderMessage('保存失败: ' + error.message, 'error');
    }
}

/**
 * 关闭工单模态框
 */
function closeWorkOrderModal() {
    document.getElementById('woModal').classList.remove('show');
    currentEditingWorkOrderId = null;
}

/**
 * 查看工单详情
 */
async function viewWorkOrderDetails(id) {
    try {
        const wo = await API.getWorkOrder(id);

        // 创建详情HTML
        const detailsHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">工单详情 - ${wo.wo_code}</h3>
                    <button class="btn btn-secondary btn-sm" onclick="closeWorkOrderDetails()">关闭</button>
                </div>
                <div class="card-body">
                    <table style="width: 100%;">
                        <tr><td style="padding: 8px; font-weight: 600;">工单编号:</td><td style="padding: 8px;">${wo.wo_code || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">设备:</td><td style="padding: 8px;">${wo.equipment_name || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">工单类型:</td><td style="padding: 8px;">${getWorkOrderTypeDisplay(wo.wo_type)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">状态:</td><td style="padding: 8px;">${renderStatusBadge(wo.status)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">优先级:</td><td style="padding: 8px;">${renderPriorityBadge(wo.priority)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">摘要:</td><td style="padding: 8px;">${wo.summary || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">描述:</td><td style="padding: 8px;">${wo.description || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">负责人:</td><td style="padding: 8px;">${wo.assignee_name || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">创建人:</td><td style="padding: 8px;">${wo.requested_by_name || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">计划开始:</td><td style="padding: 8px;">${formatDateTime(wo.planned_start)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">计划结束:</td><td style="padding: 8px;">${formatDateTime(wo.planned_end)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">实际开始:</td><td style="padding: 8px;">${formatDateTime(wo.actual_start)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">实际结束:</td><td style="padding: 8px;">${formatDateTime(wo.actual_end)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">故障代码:</td><td style="padding: 8px;">${wo.failure_code || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">根本原因:</td><td style="padding: 8px;">${wo.root_cause || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">处理措施:</td><td style="padding: 8px;">${wo.actions_taken || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">停机时间(分钟):</td><td style="padding: 8px;">${wo.downtime_minutes || 0}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">人工工时:</td><td style="padding: 8px;">${wo.labor_hours || 0}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">备件成本:</td><td style="padding: 8px;">${wo.parts_cost || 0}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">总成本:</td><td style="padding: 8px;">${wo.total_cost || 0}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">备注:</td><td style="padding: 8px;">${wo.notes || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">创建时间:</td><td style="padding: 8px;">${formatDateTime(wo.created_at)}</td></tr>
                    </table>
                </div>
            </div>
        `;

        // 保存原始内容
        const container = document.getElementById('page-workorders');
        if (!container.dataset.originalContent) {
            container.dataset.originalContent = container.innerHTML;
        }

        // 显示详情
        container.innerHTML = detailsHTML;

    } catch (error) {
        console.error('获取工单详情失败:', error);
        showWorkOrderMessage('获取工单详情失败: ' + error.message, 'error');
    }
}

/**
 * 获取工单状态操作按钮
 */
function getStatusActionButtons(wo) {
    let buttons = '';
    
    switch (wo.status) {
        case 'open':
            // 待处理状态：可以分配、开始
            if (!wo.assignee) {
                buttons += `<button class="btn btn-info btn-sm" onclick="showAssignModal(${wo.id})">分配</button>`;
            }
            buttons += `<button class="btn btn-success btn-sm" onclick="startWorkOrder(${wo.id})">开始</button>`;
            break;
            
        case 'assigned':
            // 已分配状态：可以开始
            buttons += `<button class="btn btn-success btn-sm" onclick="startWorkOrder(${wo.id})">开始</button>`;
            break;
            
        case 'in_progress':
            // 进行中状态：可以完成
            buttons += `<button class="btn btn-warning btn-sm" onclick="showCompleteModal(${wo.id})">完成</button>`;
            break;
            
        case 'completed':
            // 已完成状态：可以关闭
            buttons += `<button class="btn btn-dark btn-sm" onclick="closeWorkOrder(${wo.id})">关闭</button>`;
            break;
            
        case 'closed':
        case 'canceled':
            // 已关闭或已取消：无操作
            break;
    }
    
    return buttons;
}

/**
 * 开始工单
 */
async function startWorkOrder(id) {
    const wo = allWorkOrdersList.find(w => w.id === id);
    if (!wo) return;

    if (!confirm(`确定要开始工单 "${wo.wo_code} - ${wo.summary}" 吗？`)) {
        return;
    }

    try {
        await API.startWorkOrder(id);
        showWorkOrderMessage('工单已开始', 'success');
        loadWorkOrders();
    } catch (error) {
        console.error('开始工单失败:', error);
        showWorkOrderMessage('开始工单失败: ' + error.message, 'error');
    }
}

/**
 * 显示完成工单模态框
 */
function showCompleteModal(id) {
    const wo = allWorkOrdersList.find(w => w.id === id);
    if (!wo) return;

    const modalHTML = `
        <div id="completeModal" class="modal show">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">完成工单 - ${wo.wo_code}</h3>
                    <button class="modal-close" onclick="closeCompleteModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="completeForm">
                        <div class="form-group">
                            <label class="form-label">处理措施 <span style="color: red;">*</span></label>
                            <textarea id="actionsTaken" class="form-textarea" rows="4" required placeholder="请详细描述处理过程和采取的措施"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">根本原因</label>
                            <textarea id="rootCause" class="form-textarea" rows="3" placeholder="请分析故障的根本原因"></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div class="form-group">
                                <label class="form-label">停机时间(分钟)</label>
                                <input type="number" id="downtimeMinutes" class="form-input" min="0" value="0">
                            </div>
                            <div class="form-group">
                                <label class="form-label">人工工时</label>
                                <input type="number" id="laborHours" class="form-input" min="0" step="0.5" value="0">
                            </div>
                            <div class="form-group">
                                <label class="form-label">备件成本</label>
                                <input type="number" id="partsCost" class="form-input" min="0" step="0.01" value="0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">完成备注</label>
                            <textarea id="completionNotes" class="form-textarea" rows="2" placeholder="其他备注信息"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeCompleteModal()">取消</button>
                    <button class="btn btn-primary" onclick="completeWorkOrder(${id})">完成工单</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * 关闭完成工单模态框
 */
function closeCompleteModal() {
    const modal = document.getElementById('completeModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * 完成工单
 */
async function completeWorkOrder(id) {
    const form = document.getElementById('completeForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const actionsTaken = document.getElementById('actionsTaken').value.trim();
    if (!actionsTaken) {
        showWorkOrderMessage('请填写处理措施', 'error');
        return;
    }

    const data = {
        actions_taken: actionsTaken,
        root_cause: document.getElementById('rootCause').value.trim(),
        downtime_minutes: document.getElementById('downtimeMinutes').value || 0,
        labor_hours: document.getElementById('laborHours').value || 0,
        parts_cost: document.getElementById('partsCost').value || 0,
        notes: document.getElementById('completionNotes').value.trim()
    };

    try {
        // 直接完成工单，传递完成数据
        await API.completeWorkOrder(id, data);
        
        showWorkOrderMessage('工单已完成', 'success');
        closeCompleteModal();
        loadWorkOrders();
    } catch (error) {
        console.error('完成工单失败:', error);
        showWorkOrderMessage('完成工单失败: ' + error.message, 'error');
    }
}

/**
 * 关闭工单
 */
async function closeWorkOrder(id) {
    const wo = allWorkOrdersList.find(w => w.id === id);
    if (!wo) return;

    if (!confirm(`确定要关闭工单 "${wo.wo_code} - ${wo.summary}" 吗？\n关闭后工单将无法再修改。`)) {
        return;
    }

    try {
        await API.closeWorkOrder(id);
        showWorkOrderMessage('工单已关闭', 'success');
        loadWorkOrders();
    } catch (error) {
        console.error('关闭工单失败:', error);
        showWorkOrderMessage('关闭工单失败: ' + error.message, 'error');
    }
}

/**
 * 显示分配工单模态框
 */
async function showAssignModal(id) {
    const wo = allWorkOrdersList.find(w => w.id === id);
    if (!wo) return;

    // 加载用户列表
    try {
        const usersRes = await API.get('/auth/users/', { page_size: 1000 });
        const users = usersRes.results || [];

        const modalHTML = `
            <div id="assignModal" class="modal show">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">分配工单 - ${wo.wo_code}</h3>
                        <button class="modal-close" onclick="closeAssignModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">选择负责人 <span style="color: red;">*</span></label>
                            <select id="assigneeSelect" class="form-select" required>
                                <option value="">请选择负责人</option>
                                ${users.map(user => `
                                    <option value="${user.id}">${user.full_name || user.username} (${user.role_display || user.role})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">分配说明</label>
                            <textarea id="assignNotes" class="form-textarea" rows="3" placeholder="分配说明或特殊要求"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeAssignModal()">取消</button>
                        <button class="btn btn-primary" onclick="assignWorkOrder(${id})">分配</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('加载用户列表失败:', error);
        showWorkOrderMessage('加载用户列表失败: ' + error.message, 'error');
    }
}

/**
 * 关闭分配工单模态框
 */
function closeAssignModal() {
    const modal = document.getElementById('assignModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * 分配工单
 */
async function assignWorkOrder(id) {
    const assigneeId = document.getElementById('assigneeSelect').value;
    if (!assigneeId) {
        showWorkOrderMessage('请选择负责人', 'error');
        return;
    }

    try {
        await API.assignWorkOrder(id, assigneeId);
        showWorkOrderMessage('工单分配成功', 'success');
        closeAssignModal();
        loadWorkOrders();
    } catch (error) {
        console.error('分配工单失败:', error);
        showWorkOrderMessage('分配工单失败: ' + error.message, 'error');
    }
}

/**
 * 关闭工单详情
 */
function closeWorkOrderDetails() {
    const container = document.getElementById('page-workorders');
    if (container.dataset.originalContent) {
        container.innerHTML = container.dataset.originalContent;
        // 重新加载数据
        loadWorkOrders();
    }
}

/**
 * 删除工单
 */
async function deleteWorkOrder(id) {
    if (!canManageWorkOrders()) {
        showWorkOrderMessage('只有管理员和主管可以删除工单', 'error');
        return;
    }

    const wo = allWorkOrdersList.find(w => w.id === id);
    if (!wo) return;

    if (!confirm(`确定要删除工单 "${wo.wo_code} - ${wo.summary}" 吗？`)) {
        return;
    }

    try {
        await API.deleteWorkOrder(id);
        showWorkOrderMessage('工单删除成功', 'success');
        loadWorkOrders();
    } catch (error) {
        console.error('删除工单失败:', error);
        showWorkOrderMessage('删除失败: ' + error.message, 'error');
    }
}

/**
 * 加载工单列表
 */
async function loadWorkOrders() {
    try {
        const res = await API.getWorkOrders({ page_size: 50, ordering: '-created_at' });
        renderWorkOrdersTable(res.results || []);
    } catch (error) {
        console.error('加载工单列表失败:', error);
        showWorkOrderMessage('加载工单列表失败: ' + error.message, 'error');
    }
}

/**
 * 搜索工单
 */
async function searchWorkOrders() {
    const search = document.getElementById('woSearch').value;
    const status = document.getElementById('woStatusFilter').value;

    try {
        const params = { page_size: 50, ordering: '-created_at' };
        if (search) params.search = search;
        if (status) params.status = status;

        const res = await API.getWorkOrders(params);
        renderWorkOrdersTable(res.results || []);
    } catch (error) {
        console.error('搜索工单失败:', error);
        showWorkOrderMessage('搜索失败', 'error');
    }
}

/**
 * 渲染工单表格
 */
function renderWorkOrdersTable(workOrders) {
    allWorkOrdersList = workOrders || [];
    const tbody = document.getElementById('workOrdersTableBody');
    const canManage = canManageWorkOrders();

    if (!workOrders || workOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--gray-500);">暂无工单</td></tr>';
        return;
    }

    tbody.innerHTML = workOrders.map(wo => `
        <tr>
            <td>${wo.wo_code || '-'}</td>
            <td>${wo.summary || '-'}</td>
            <td>${wo.equipment_name || '-'}</td>
            <td>${getWorkOrderTypeDisplay(wo.wo_type)}</td>
            <td>${renderPriorityBadge(wo.priority)}</td>
            <td>${renderStatusBadge(wo.status)}</td>
            <td>${wo.assignee_name || '-'}</td>
            <td>${formatDate(wo.created_at)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewWorkOrderDetails(${wo.id})">查看</button>
                ${canManage ? `
                    <button class="btn btn-secondary btn-sm" onclick="editWorkOrderModal(${wo.id})">编辑</button>
                    ${getStatusActionButtons(wo)}
                    <button class="btn btn-danger btn-sm" onclick="deleteWorkOrder(${wo.id})">删除</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

/**
 * 获取工单类型显示文本
 */
function getWorkOrderTypeDisplay(type) {
    const types = {
        'PM': '预防性维护',
        'CM': '纠正性维护',
        'inspection': '点检'
    };
    return types[type] || type || '-';
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
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
function showWorkOrderMessage(message, type = 'success') {
    if (typeof showMessage !== 'undefined') {
        showMessage(message, type);
    } else {
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
 * 渲染优先级标签
 */
function renderPriorityBadge(priority) {
    const badges = {
        'low': '<span class="badge badge-info">低</span>',
        'medium': '<span class="badge badge-warning">中</span>',
        'high': '<span class="badge badge-danger">高</span>',
        'critical': '<span class="badge badge-danger" style="background-color: #dc2626;">紧急</span>'
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
        'canceled': '<span class="badge badge-danger">已取消</span>'
    };
    return badges[status] || `<span class="badge badge-secondary">${status}</span>`;
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
 * 下载工单导入模板
 */
async function downloadWorkOrderTemplate() {
    try {
        const blob = await API.downloadWorkOrderTemplate();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '工单导入模板.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showWorkOrderMessage('模板下载成功', 'success');
    } catch (error) {
        console.error('下载模板失败:', error);
        showWorkOrderMessage('下载模板失败: ' + error.message, 'error');
    }
}

/**
 * 显示工单导入对话框
 */
function showWorkOrderImportDialog() {
    if (!canManageWorkOrders()) {
        showWorkOrderMessage('只有管理员和主管可以导入工单', 'error');
        return;
    }

    // 创建导入对话框HTML
    const dialogHTML = `
        <div id="workOrderImportDialog" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">批量导入工单</h3>
                    <button class="modal-close" onclick="closeWorkOrderImportDialog()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">1. 下载导入模板</label>
                        <button class="btn btn-secondary" onclick="downloadWorkOrderTemplate()">下载Excel模板</button>
                    </div>
                    <div class="form-group">
                        <label class="form-label">2. 选择要导入的文件</label>
                        <input type="file" id="importWorkOrderFile" class="form-input" accept=".xlsx,.xls,.csv">
                        <small style="color: var(--gray-500);">支持 Excel (.xlsx, .xls) 或 CSV 文件</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">注意事项</label>
                        <ul style="color: var(--gray-600); font-size: 14px; padding-left: 20px;">
                            <li>设备编码必填（必须在设备台账中存在）</li>
                            <li>工单摘要必填</li>
                            <li>日期时间格式: YYYY-MM-DD HH:MM</li>
                            <li>工单号自动生成，无需填写</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeWorkOrderImportDialog()">取消</button>
                    <button class="btn btn-primary" onclick="importWorkOrders()">导入</button>
                </div>
            </div>
        </div>
    `;

    // 添加到页面
    const existingDialog = document.getElementById('workOrderImportDialog');
    if (existingDialog) {
        existingDialog.remove();
    }

    document.body.insertAdjacentHTML('beforeend', dialogHTML);
}

/**
 * 关闭工单导入对话框
 */
function closeWorkOrderImportDialog() {
    const dialog = document.getElementById('workOrderImportDialog');
    if (dialog) {
        dialog.remove();
    }
}

/**
 * 导入工单
 */
async function importWorkOrders() {
    const fileInput = document.getElementById('importWorkOrderFile');
    const file = fileInput.files[0];

    if (!file) {
        showWorkOrderMessage('请选择要导入的文件', 'error');
        return;
    }

    // 显示加载提示
    showWorkOrderMessage('正在导入，请稍候...', 'info');

    try {
        const result = await API.importWorkOrders(file);

        // 显示导入结果
        if (result.success_count > 0) {
            showWorkOrderMessage(result.message, 'success');
            closeWorkOrderImportDialog();

            // 重新加载工单列表
            loadWorkOrders();

            // 如果有错误，显示详情
            if (result.error_count > 0 && result.errors.length > 0) {
                setTimeout(() => {
                    alert('导入完成，但有部分失败:\n\n' + result.errors.join('\n'));
                }, 500);
            }
        } else {
            showWorkOrderMessage(result.message, 'error');
            if (result.errors.length > 0) {
                alert('导入失败:\n\n' + result.errors.join('\n'));
            }
        }
    } catch (error) {
        console.error('导入失败:', error);
        showWorkOrderMessage('导入失败: ' + error.message, 'error');
    }
}

/**
 * 导出工单列表
 */
async function exportWorkOrders() {
    try {
        const blob = await API.exportWorkOrders();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // 生成文件名（带时间戳）
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.download = `工单列表_${timestamp}.xlsx`;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showWorkOrderMessage('导出成功', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showWorkOrderMessage('导出失败: ' + error.message, 'error');
    }
}
