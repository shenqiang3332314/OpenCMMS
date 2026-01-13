/**
 * API 公共模块
 * 封装所有API调用
 */

const API_BASE = '/api';

/**
 * API 请求封装
 */
class API {
    /**
     * 获取认证头
     */
    static getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }

    /**
     * 处理响应
     */
    static async handleResponse(response) {
        // 401 未授权 - 尝试刷新token或跳转登录
        if (response.status === 401) {
            console.log('收到401响应，尝试刷新token...');
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    const refreshResponse = await fetch(`${API_BASE}/auth/token/refresh/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh: refreshToken })
                    });

                    if (refreshResponse.ok) {
                        const data = await refreshResponse.json();
                        localStorage.setItem('access_token', data.access);
                        console.log('Token刷新成功，重试原请求');
                        // 重试原请求
                        const retryResponse = await fetch(response.url, {
                            method: response.init?.method || 'GET',
                            headers: this.getAuthHeaders(),
                            body: response.init?.body
                        });
                        return this.handleResponse(retryResponse);
                    } else {
                        console.error('刷新Token失败:', refreshResponse.status);
                    }
                } catch (e) {
                    console.error('刷新Token异常:', e);
                }
            }
            // 刷新失败，跳转到登录页
            console.log('刷新失败，跳转到登录页');
            localStorage.clear();
            window.location.href = '/static/login.html';
            throw new Error('登录已过期，请重新登录');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('API请求失败:', response.status, response.url, error);
            const errorMsg = error.detail || error.message || `请求失败 (状态码: ${response.status})`;
            throw new Error(errorMsg);
        }

        return response.json();
    }

    /**
     * GET 请求
     */
    static async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${API_BASE}${url}?${queryString}` : `${API_BASE}${url}`;

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    /**
     * POST 请求
     */
    static async post(url, data = {}) {
        console.log('API POST请求:', `${API_BASE}${url}`, data);
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });

        const result = await this.handleResponse(response);
        console.log('API POST响应:', result);
        return result;
    }

    /**
     * PUT 请求
     */
    static async put(url, data = {}) {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });

        return this.handleResponse(response);
    }

    /**
     * PATCH 请求
     */
    static async patch(url, data = {}) {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });

        return this.handleResponse(response);
    }

    /**
     * DELETE 请求
     */
    static async delete(url) {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });

        return this.handleResponse(response);
    }

    // ========== 认证 API ==========

    /**
     * 登录
     */
    static async login(username, password) {
        return this.post('/auth/login/', { username, password });
    }

    /**
     * 登出
     */
    static async logout() {
        return this.post('/auth/logout/');
    }

    /**
     * 获取当前用户信息
     */
    static async getCurrentUser() {
        return this.get('/auth/me/');
    }

    // ========== 设备 API ==========

    /**
     * 获取设备列表（自动获取所有页）
     */
    static async getAssets(params = {}) {
        // 如果明确指定了page参数，说明要获取特定页，直接返回单页结果
        if (params.page) {
            return this.get('/assets/', params);
        }

        // 如果指定了page_size但没有指定page，或者没有指定任何分页参数，获取所有数据
        // 使用较大的page_size来减少请求次数
        const requestPageSize = params.page_size || 1000;
        
        // 先尝试一次性获取所有数据
        const firstResponse = await this.get('/assets/', { ...params, page_size: requestPageSize });
        
        // 如果没有下一页，直接返回结果
        if (!firstResponse.next) {
            return firstResponse;
        }

        // 如果有下一页，继续获取剩余数据
        let allResults = [...(firstResponse.results || [])];
        let nextUrl = firstResponse.next;

        while (nextUrl) {
            const response = await fetch(nextUrl, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            const data = await this.handleResponse(response);
            allResults = allResults.concat(data.results || []);
            nextUrl = data.next;
        }

        return { 
            results: allResults, 
            count: allResults.length,
            next: null,
            previous: null
        };
    }

    /**
     * 获取设备详情
     */
    static async getAsset(id) {
        return this.get(`/assets/${id}/`);
    }

    /**
     * 创建设备
     */
    static async createAsset(data) {
        return this.post('/assets/', data);
    }

    /**
     * 更新设备
     */
    static async updateAsset(id, data) {
        return this.put(`/assets/${id}/`, data);
    }

    /**
     * 删除设备
     */
    static async deleteAsset(id) {
        return this.delete(`/assets/${id}/`);
    }

    /**
     * 下载设备导入模板
     */
    static async downloadAssetTemplate() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('请先登录');
        }

        const response = await fetch(`${API_BASE}/assets/download_template/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`下载失败: ${response.status} ${response.statusText}`);
        }

        // 获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        let filename = '设备导入模板.xlsx';
        if (contentDisposition) {
            const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (matches && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
                // 处理编码的文件名
                if (filename.startsWith('=?utf-8?b?')) {
                    try {
                        const base64 = filename.substring(10, filename.length - 2);
                        filename = atob(base64);
                        filename = decodeURIComponent(escape(filename));
                    } catch (e) {
                        filename = '设备导入模板.xlsx';
                    }
                }
            }
        }

        // 创建下载链接
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        return { success: true, filename };
    }

    /**
     * 导入设备（Excel/CSV）
     */
    static async importAssets(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/assets/import_excel/`, {
            method: 'POST',
            headers: {
                ...(this.getAuthHeaders()['Authorization'] ? { 'Authorization': this.getAuthHeaders()['Authorization'] } : {})
            },
            body: formData
        });

        return this.handleResponse(response);
    }

    /**
     * 导出设备台账
     */
    static async exportAssets(params = {}) {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('请先登录');
        }

        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${API_BASE}/assets/export_csv/?${queryString}` : `${API_BASE}/assets/export_csv/`;

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`导出失败: ${response.status} ${response.statusText}`);
        }

        // 获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        let filename = '设备台账导出.xlsx';
        if (contentDisposition) {
            const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (matches && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
                // 处理编码的文件名
                if (filename.startsWith('=?utf-8?b?')) {
                    try {
                        const base64 = filename.substring(10, filename.length - 2);
                        filename = atob(base64);
                        filename = decodeURIComponent(escape(filename));
                    } catch (e) {
                        filename = '设备台账导出.xlsx';
                    }
                }
            }
        }

        // 创建下载链接
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        return { success: true, filename };
    }

    // ========== 工单 API ==========

    /**
     * 获取工单列表
     */
    static async getWorkOrders(params = {}) {
        return this.get('/workorders/', params);
    }

    /**
     * 获取工单详情
     */
    static async getWorkOrder(id) {
        return this.get(`/workorders/${id}/`);
    }

    /**
     * 创建工单
     */
    static async createWorkOrder(data) {
        return this.post('/workorders/', data);
    }

    /**
     * 更新工单
     */
    static async updateWorkOrder(id, data) {
        return this.put(`/workorders/${id}/`, data);
    }

    /**
     * 删除工单
     */
    static async deleteWorkOrder(id) {
        return this.delete(`/workorders/${id}/`);
    }

    /**
     * 分配工单
     */
    static async assignWorkOrder(id, assigneeId) {
        return this.post(`/workorders/${id}/assign/`, { assignee_id: assigneeId });
    }

    /**
     * 开始工单
     */
    static async startWorkOrder(id) {
        return this.post(`/workorders/${id}/start/`);
    }

    /**
     * 完成工单
     */
    static async completeWorkOrder(id, data) {
        return this.post(`/workorders/${id}/complete/`, data);
    }

    /**
     * 关闭工单
     */
    static async closeWorkOrder(id) {
        return this.post(`/workorders/${id}/close/`);
    }

    /**
     * 下载工单导入模板
     */
    static async downloadWorkOrderTemplate() {
        const response = await fetch(`${API_BASE}/workorders/download_template/`, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`请求失败 (状态码: ${response.status})`);
        }

        return response.blob();
    }

    /**
     * 导入工单（Excel/CSV）
     */
    static async importWorkOrders(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/workorders/import_excel/`, {
            method: 'POST',
            headers: {
                ...(this.getAuthHeaders()['Authorization'] ? { 'Authorization': this.getAuthHeaders()['Authorization'] } : {})
            },
            body: formData
        });

        return this.handleResponse(response);
    }

    /**
     * 导出工单列表
     */
    static async exportWorkOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${API_BASE}/workorders/export_csv/?${queryString}` : `${API_BASE}/workorders/export_csv/`;

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`请求失败 (状态码: ${response.status})`);
        }

        return response.blob();
    }

    // ========== 保养计划 API ==========

    /**
     * 获取保养计划列表
     */
    static async getMaintenancePlans(params = {}) {
        return this.get('/maintenance/plans/', params);
    }

    /**
     * 获取保养计划详情
     */
    static async getMaintenancePlan(id) {
        return this.get(`/maintenance/plans/${id}/`);
    }

    /**
     * 创建保养计划
     */
    static async createMaintenancePlan(data) {
        return this.post('/maintenance/plans/', data);
    }

    /**
     * 更新保养计划
     */
    static async updateMaintenancePlan(id, data) {
        return this.put(`/maintenance/plans/${id}/`, data);
    }

    /**
     * 删除保养计划
     */
    static async deleteMaintenancePlan(id) {
        return this.delete(`/maintenance/plans/${id}/`);
    }

    // ========== 点检记录 API ==========

    /**
     * 获取点检记录列表
     */
    static async getInspections(params = {}) {
        return this.get('/inspections/', params);
    }

    /**
     * 创建点检记录
     */
    static async createInspection(data) {
        return this.post('/inspections/', data);
    }

    // ========== 备件 API ==========

    /**
     * 获取备件列表
     */
    static async getSpareParts(params = {}) {
        return this.get('/spareparts/', params);
    }

    /**
     * 获取备件详情
     */
    static async getSparePart(id) {
        return this.get(`/spareparts/${id}/`);
    }

    /**
     * 创建备件
     */
    static async createSparePart(data) {
        return this.post('/spareparts/', data);
    }

    /**
     * 更新备件
     */
    static async updateSparePart(id, data) {
        return this.put(`/spareparts/${id}/`, data);
    }

    /**
     * 删除备件
     */
    static async deleteSparePart(id) {
        return this.delete(`/spareparts/${id}/`);
    }

    /**
     * 备件入库
     */
    static async stockIn(partId, quantity, data = {}) {
        return this.post(`/spareparts/${partId}/stock-in/`, {
            quantity,
            ...data
        });
    }

    /**
     * 备件出库
     */
    static async stockOut(partId, quantity, data = {}) {
        return this.post(`/spareparts/${partId}/stock-out/`, {
            quantity,
            ...data
        });
    }

    // ========== 报表 API ==========

    /**
     * 获取工单报表
     */
    static async getWorkOrderReport(params = {}) {
        return this.get('/reports/workorders/', params);
    }

    /**
     * 获取停机统计
     */
    static async getDowntimeReport(params = {}) {
        return this.get('/reports/downtime/', params);
    }

    /**
     * 获取备件消耗统计
     */
    static async getSparePartUsageReport(params = {}) {
        return this.get('/reports/spareparts-usage/', params);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
