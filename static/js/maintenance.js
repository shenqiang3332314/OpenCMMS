/**
 * 保养计划管理模块
 */

let currentEditingPlanId = null;
let allPlans = [];
let availableAssetsForMaintenance = [];

/**
 * 检查用户是否可以管理保养计划
 */
function canManageMaintenance() {
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
 * 加载设备列表
 */
async function loadAssetsList() {
    try {
        const res = await API.getAssets({ page_size: 1000, status: 'active' });
        availableAssetsForMaintenance = res.results || [];
        console.log('加载设备列表:', availableAssetsForMaintenance.length, '个设备');
    } catch (error) {
        console.error('加载设备列表失败:', error);
        showMaintenanceMessage('加载设备列表失败: ' + error.message, 'error');
        availableAssetsForMaintenance = [];
    }
}

/**
 * 显示创建保养计划模态框
 */
async function showMaintenancePlanModal() {
    if (!canManageMaintenance()) {
        showMaintenanceMessage('只有管理员和主管可以创建保养计划', 'error');
        return;
    }

    currentEditingPlanId = null;

    // 加载设备列表
    await loadAssetsList();

    // 更新模态框标题
    document.getElementById('planModalTitle').textContent = '创建保养计划';

    // 重置表单
    document.getElementById('planForm').reset();

    // 填充设备下拉列表
    populateEquipmentSelectForPlan();

    // 设置默认值
    document.getElementById('planTriggerType').value = 'time';
    document.getElementById('planPriority').value = 'medium';
    document.getElementById('planIsActive').checked = true;
    showFrequencyOptions();

    // 显示模态框
    document.getElementById('planModal').classList.add('show');
}

/**
 * 填充设备下拉列表
 */
function populateEquipmentSelectForPlan() {
    const select = document.getElementById('planEquipment');
    select.innerHTML = '<option value="">请选择设备</option>';
    availableAssetsForMaintenance.forEach(asset => {
        const option = document.createElement('option');
        option.value = asset.id;
        option.textContent = `${asset.code} - ${asset.name}`;
        select.appendChild(option);
    });
}

/**
 * 显示/隐藏频率选项
 */
function showFrequencyOptions() {
    const triggerType = document.getElementById('planTriggerType').value;
    const timeBasedOptions = document.getElementById('timeBasedOptions');
    const counterBasedOptions = document.getElementById('counterBasedOptions');

    if (triggerType === 'time') {
        timeBasedOptions.style.display = 'block';
        counterBasedOptions.style.display = 'none';
    } else {
        timeBasedOptions.style.display = 'none';
        counterBasedOptions.style.display = 'block';
    }
}

/**
 * 显示编辑保养计划模态框
 */
async function editMaintenancePlanModal(id) {
    if (!canManageMaintenance()) {
        showMaintenanceMessage('只有管理员和主管可以编辑保养计划', 'error');
        return;
    }

    currentEditingPlanId = id;

    // 加载设备列表
    await loadAssetsList();

    // 更新模态框标题
    document.getElementById('planModalTitle').textContent = '编辑保养计划';

    try {
        const plan = await API.getMaintenancePlan(id);

        // 填充设备下拉列表
        populateEquipmentSelectForPlan();

        // 填充表单
        document.getElementById('planCode').value = plan.code || '';
        document.getElementById('planEquipment').value = plan.equipment || '';
        document.getElementById('planTitle').value = plan.title || '';
        document.getElementById('planDescription').value = plan.description || '';
        document.getElementById('planTriggerType').value = plan.trigger_type || 'time';
        document.getElementById('planFrequencyValue').value = plan.frequency_value || '';
        document.getElementById('planFrequencyUnit').value = plan.frequency_unit || 'month';
        document.getElementById('planCounterName').value = plan.counter_name || '';
        document.getElementById('planCounterThreshold').value = plan.counter_threshold || '';
        document.getElementById('planChecklistTemplate').value = plan.checklist_template ? JSON.stringify(plan.checklist_template, null, 2) : '[]';
        document.getElementById('planEstimatedHours').value = plan.estimated_hours || '';
        document.getElementById('planEstimatedCost').value = plan.estimated_cost || '';
        document.getElementById('planRequiredSkills').value = plan.required_skills || '';
        document.getElementById('planPriority').value = plan.priority || 'medium';
        document.getElementById('planIsActive').checked = plan.is_active;

        showFrequencyOptions();

        // 显示模态框
        document.getElementById('planModal').classList.add('show');

    } catch (error) {
        console.error('获取保养计划信息失败:', error);
        showMaintenanceMessage('获取保养计划信息失败: ' + error.message, 'error');
    }
}

/**
 * 保存保养计划（新增或编辑）
 */
async function saveMaintenancePlan() {
    const form = document.getElementById('planForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const triggerType = document.getElementById('planTriggerType').value;

    const data = {
        code: document.getElementById('planCode').value.trim(),
        equipment: document.getElementById('planEquipment').value || null,
        title: document.getElementById('planTitle').value.trim(),
        description: document.getElementById('planDescription').value.trim(),
        trigger_type: triggerType,
        priority: document.getElementById('planPriority').value,
        is_active: document.getElementById('planIsActive').checked,
        required_skills: document.getElementById('planRequiredSkills').value.trim(),
        estimated_hours: document.getElementById('planEstimatedHours').value || null,
        estimated_cost: document.getElementById('planEstimatedCost').value || null,
    };

    // 时间触发类型
    if (triggerType === 'time') {
        data.frequency_value = document.getElementById('planFrequencyValue').value || null;
        data.frequency_unit = document.getElementById('planFrequencyUnit').value || null;
        data.counter_name = null;
        data.counter_threshold = null;
    } else {
        // 计数器触发类型
        data.frequency_value = null;
        data.frequency_unit = null;
        data.counter_name = document.getElementById('planCounterName').value.trim();
        data.counter_threshold = document.getElementById('planCounterThreshold').value || null;
    }

    // 检查清单模板
    const checklistStr = document.getElementById('planChecklistTemplate').value.trim();
    try {
        data.checklist_template = checklistStr ? JSON.parse(checklistStr) : [];
    } catch (e) {
        showMaintenanceMessage('检查清单模板格式错误，请输入有效的JSON数组', 'error');
        return;
    }

    // 清理空值
    Object.keys(data).forEach(key => {
        if (data[key] === '') {
            data[key] = null;
        }
    });

    console.log('保存保养计划数据:', data);

    try {
        if (currentEditingPlanId) {
            // 编辑
            await API.updateMaintenancePlan(currentEditingPlanId, data);
            showMaintenanceMessage('保养计划更新成功', 'success');
        } else {
            // 新增
            await API.createMaintenancePlan(data);
            showMaintenanceMessage('保养计划创建成功', 'success');
        }

        // 关闭模态框
        closeMaintenancePlanModal();

        // 重新加载列表
        loadMaintenancePlans();

    } catch (error) {
        console.error('保存保养计划失败:', error);
        showMaintenanceMessage('保存失败: ' + error.message, 'error');
    }
}

/**
 * 关闭保养计划模态框
 */
function closeMaintenancePlanModal() {
    document.getElementById('planModal').classList.remove('show');
    currentEditingPlanId = null;
}

/**
 * 查看保养计划详情
 */
async function viewMaintenancePlanDetails(id) {
    try {
        const plan = await API.getMaintenancePlan(id);

        // 创建详情HTML
        const detailsHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">保养计划详情 - ${plan.code}</h3>
                    <button class="btn btn-secondary btn-sm" onclick="closeMaintenancePlanDetails()">关闭</button>
                </div>
                <div class="card-body">
                    <table style="width: 100%;">
                        <tr><td style="padding: 8px; font-weight: 600;">计划编号:</td><td style="padding: 8px;">${plan.code || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">设备:</td><td style="padding: 8px;">${plan.equipment_name || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">标题:</td><td style="padding: 8px;">${plan.title || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">描述:</td><td style="padding: 8px;">${plan.description || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">触发类型:</td><td style="padding: 8px;">${plan.trigger_type_display || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">频率:</td><td style="padding: 8px;">${plan.frequency_display || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">优先级:</td><td style="padding: 8px;">${getPriorityDisplay(plan.priority)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">预估工时:</td><td style="padding: 8px;">${plan.estimated_hours || '-'} 小时</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">预估成本:</td><td style="padding: 8px;">${plan.estimated_cost || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">所需技能:</td><td style="padding: 8px;">${plan.required_skills || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">状态:</td><td style="padding: 8px;">${plan.is_active ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-secondary">停用</span>'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">上次生成日期:</td><td style="padding: 8px;">${formatDate(plan.last_generated_date)}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">创建人:</td><td style="padding: 8px;">${plan.created_by_name || '-'}</td></tr>
                        <tr><td style="padding: 8px; font-weight: 600;">创建时间:</td><td style="padding: 8px;">${formatDateTime(plan.created_at)}</td></tr>
                    </table>
                    ${plan.checklist_template && plan.checklist_template.length > 0 ? `
                        <div style="margin-top: 16px;">
                            <h4 style="margin-bottom: 8px;">检查清单:</h4>
                            <ul style="padding-left: 20px;">
                                ${plan.checklist_template.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // 保存原始内容
        const container = document.getElementById('page-maintenance');
        if (!container.dataset.originalContent) {
            container.dataset.originalContent = container.innerHTML;
        }

        // 显示详情
        container.innerHTML = detailsHTML;

    } catch (error) {
        console.error('获取保养计划详情失败:', error);
        showMaintenanceMessage('获取保养计划详情失败: ' + error.message, 'error');
    }
}

/**
 * 关闭保养计划详情
 */
function closeMaintenancePlanDetails() {
    const container = document.getElementById('page-maintenance');
    if (container.dataset.originalContent) {
        container.innerHTML = container.dataset.originalContent;
        loadMaintenancePlans();
    }
}

/**
 * 删除保养计划
 */
async function deleteMaintenancePlan(id) {
    if (!canManageMaintenance()) {
        showMaintenanceMessage('只有管理员和主管可以删除保养计划', 'error');
        return;
    }

    const plan = allPlans.find(p => p.id === id);
    if (!plan) return;

    if (!confirm(`确定要删除保养计划 "${plan.code} - ${plan.title}" 吗？`)) {
        return;
    }

    try {
        await API.deleteMaintenancePlan(id);
        showMaintenanceMessage('保养计划删除成功', 'success');
        loadMaintenancePlans();
    } catch (error) {
        console.error('删除保养计划失败:', error);
        showMaintenanceMessage('删除失败: ' + error.message, 'error');
    }
}

/**
 * 生成工单
 */
async function generateWorkOrder(id) {
    const plan = allPlans.find(p => p.id === id);
    if (!plan) return;

    if (!confirm(`确定要根据保养计划 "${plan.code} - ${plan.title}" 生成工单吗？`)) {
        return;
    }

    try {
        const result = await API.post(`/maintenance/plans/${id}/generate_work_order/`, {});
        showMaintenanceMessage(`工单 ${result.wo_code} 生成成功`, 'success');
        loadMaintenancePlans();
    } catch (error) {
        console.error('生成工单失败:', error);
        showMaintenanceMessage('生成工单失败: ' + error.message, 'error');
    }
}

/**
 * 启用/停用保养计划
 */
async function toggleMaintenancePlan(id) {
    const plan = allPlans.find(p => p.id === id);
    if (!plan) return;

    const action = plan.is_active ? '停用' : '启用';
    if (!confirm(`确定要${action}保养计划 "${plan.code}" 吗？`)) {
        return;
    }

    try {
        if (plan.is_active) {
            await API.post(`/maintenance/plans/${id}/deactivate/`, {});
        } else {
            await API.post(`/maintenance/plans/${id}/activate/`, {});
        }
        showMaintenanceMessage(`保养计划${action}成功`, 'success');
        loadMaintenancePlans();
    } catch (error) {
        console.error(`${action}保养计划失败:`, error);
        showMaintenanceMessage(`${action}失败: ` + error.message, 'error');
    }
}

/**
 * 渲染保养计划表格
 */
function renderMaintenancePlansTable(plans) {
    allPlans = plans || [];
    const tbody = document.getElementById('maintenancePlansTableBody');
    const canManage = canManageMaintenance();

    if (!plans || plans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--gray-500);">暂无保养计划</td></tr>';
        return;
    }

    tbody.innerHTML = plans.map(plan => `
        <tr>
            <td>${plan.code || '-'}</td>
            <td>${plan.equipment_name || '-'}</td>
            <td>${plan.title || '-'}</td>
            <td>${plan.trigger_type_display || '-'}</td>
            <td>${plan.frequency_display || '-'}</td>
            <td>${getPriorityDisplay(plan.priority)}</td>
            <td>${plan.is_active ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-secondary">停用</span>'}</td>
            <td>${formatDate(plan.last_generated_date)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewMaintenancePlanDetails(${plan.id})">查看</button>
                ${canManage ? `
                    <button class="btn btn-secondary btn-sm" onclick="editMaintenancePlanModal(${plan.id})">编辑</button>
                    <button class="btn btn-success btn-sm" onclick="generateWorkOrder(${plan.id})" ${!plan.is_active ? 'disabled' : ''}>生成工单</button>
                    <button class="btn btn-warning btn-sm" onclick="toggleMaintenancePlan(${plan.id})">${plan.is_active ? '停用' : '启用'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMaintenancePlan(${plan.id})">删除</button>
                ` : `
                    <button class="btn btn-success btn-sm" onclick="generateWorkOrder(${plan.id})" ${!plan.is_active ? 'disabled' : ''}>生成工单</button>
                `}
            </td>
        </tr>
    `).join('');
}

/**
 * 加载保养计划列表
 */
async function loadMaintenancePlans() {
    try {
        const res = await API.getMaintenancePlans({ page_size: 50 });
        renderMaintenancePlansTable(res.results || []);
    } catch (error) {
        console.error('加载保养计划列表失败:', error);
        showMaintenanceMessage('加载保养计划列表失败: ' + error.message, 'error');
    }
}

/**
 * 搜索保养计划
 */
async function searchMaintenancePlans() {
    const search = document.getElementById('planSearch').value;
    const triggerType = document.getElementById('planTriggerTypeFilter').value;
    const isActive = document.getElementById('planIsActiveFilter').value;

    try {
        const params = { page_size: 50 };
        if (search) params.search = search;
        if (triggerType) params.trigger_type = triggerType;
        if (isActive !== '') params.is_active = isActive === 'true';

        const res = await API.getMaintenancePlans(params);
        renderMaintenancePlansTable(res.results || []);
    } catch (error) {
        console.error('搜索保养计划失败:', error);
        showMaintenanceMessage('搜索失败', 'error');
    }
}

/**
 * 获取优先级显示文本
 */
function getPriorityDisplay(priority) {
    const priorities = {
        'low': '<span class="badge badge-info">低</span>',
        'medium': '<span class="badge badge-warning">中</span>',
        'high': '<span class="badge badge-danger">高</span>'
    };
    return priorities[priority] || priority || '-';
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
 * 格式化日期
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
}

/**
 * 显示消息提示
 */
function showMaintenanceMessage(message, type = 'success') {
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
