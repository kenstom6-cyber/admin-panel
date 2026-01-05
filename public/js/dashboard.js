// Các biến toàn cục
let currentPage = 'dashboard';
let currentKeyPage = 1;
let apiCallCounter = 0;

// Tăng bộ đếm API calls
function incrementApiCall() {
    apiCallCounter++;
    document.getElementById('apiCallCount').textContent = apiCallCounter;
}

// Kiểm tra auth
async function checkAuth() {
    try {
        incrementApiCall();
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/';
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Cập nhật server status
async function updateServerStatus() {
    try {
        incrementApiCall();
        const response = await fetch('/api/status');
        const data = await response.json();
        
        const statusEl = document.getElementById('serverStatus');
        statusEl.textContent = data.status === 'online' ? 'Online' : 'Offline';
        statusEl.className = data.status === 'online' ? 'text-green-400' : 'text-red-400';
    } catch (error) {
        document.getElementById('serverStatus').textContent = 'Offline';
        document.getElementById('serverStatus').className = 'text-red-400';
    }
}

// ========== PAGE LOADERS ==========

// Load dashboard overview
async function loadDashboard() {
    currentPage = 'dashboard';
    updatePageTitle('Tổng Quan Dashboard', 'Thống kê hệ thống');
    
    try {
        incrementApiCall();
        const [statsResponse, keysResponse] = await Promise.all([
            fetch('/api/keys/stats'),
            fetch('/api/keys?limit=5')
        ]);
        
        const stats = await statsResponse.json();
        const keys = await keysResponse.json();
        
        const html = `
            <!-- Thống kê nhanh -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="stat-card bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm text-gray-600">Tổng số Key</p>
                            <p class="text-3xl font-bold text-gray-900">${stats.total?.total_keys || 0}</p>
                        </div>
                        <i class="fas fa-key text-2xl text-blue-500"></i>
                    </div>
                    <div class="mt-4 text-sm text-gray-500">
                        <i class="fas fa-chart-line mr-1"></i>
                        Tổng lượt dùng: ${stats.total?.total_usage_all || 0}
                    </div>
                </div>
                
                <div class="stat-card bg-white rounded-xl shadow p-6 border-l-4 border-green-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm text-gray-600">Key Active</p>
                            <p class="text-3xl font-bold text-gray-900">${stats.stats?.find(s => s.status === 'active')?.count || 0}</p>
                        </div>
                        <i class="fas fa-check-circle text-2xl text-green-500"></i>
                    </div>
                    <div class="mt-4 text-sm text-gray-500">
                        <i class="fas fa-percentage mr-1"></i>
                        ${stats.total?.total_keys ? Math.round((stats.stats?.find(s => s.status === 'active')?.count || 0) / stats.total.total_keys * 100) : 0}% tổng số
                    </div>
                </div>
                
                <div class="stat-card bg-white rounded-xl shadow p-6 border-l-4 border-amber-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm text-gray-600">Key Locked</p>
                            <p class="text-3xl font-bold text-gray-900">${stats.stats?.find(s => s.status === 'locked')?.count || 0}</p>
                        </div>
                        <i class="fas fa-lock text-2xl text-amber-500"></i>
                    </div>
                    <div class="mt-4 text-sm text-gray-500">
                        <i class="fas fa-exclamation-triangle mr-1"></i>
                        Cần xem xét
                    </div>
                </div>
                
                <div class="stat-card bg-white rounded-xl shadow p-6 border-l-4 border-purple-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm text-gray-600">Avg Usage</p>
                            <p class="text-3xl font-bold text-gray-900">${Math.round(stats.total?.avg_usage || 0)}</p>
                        </div>
                        <i class="fas fa-chart-bar text-2xl text-purple-500"></i>
                    </div>
                    <div class="mt-4 text-sm text-gray-500">
                        <i class="fas fa-calculator mr-1"></i>
                        Lượt dùng trung bình/key
                    </div>
                </div>
            </div>
            
            <!-- Key gần đây -->
            <div class="bg-white rounded-xl shadow mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">
                        <i class="fas fa-history mr-2"></i>Key Được Tạo Gần Đây
                    </h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">ID</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Key</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Owner</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Usage</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Created</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${keys.keys && keys.keys.length > 0 ? keys.keys.map(key => `
                                <tr class="hover:bg-gray-50">
                                    <td class="py-3 px-4 font-mono text-sm">${key.id}</td>
                                    <td class="py-3 px-4 font-mono">
                                        <code class="bg-gray-100 px-2 py-1 rounded text-xs">${key.key.substring(0, 20)}...</code>
                                    </td>
                                    <td class="py-3 px-4">${key.owner || '<span class="text-gray-400">-</span>'}</td>
                                    <td class="py-3 px-4">
                                        <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(key.status)}">
                                            ${getStatusText(key.status)}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <div class="flex items-center">
                                            <span class="font-semibold mr-2">${key.usage_count}</span>
                                            ${key.usage_limit > 0 ? 
                                                `<div class="w-16 bg-gray-200 rounded-full h-2">
                                                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${Math.min(100, (key.usage_count / key.usage_limit) * 100)}%"></div>
                                                </div>` : ''
                                            }
                                        </div>
                                    </td>
                                    <td class="py-3 px-4 text-sm text-gray-500">${formatDate(key.created_at)}</td>
                                </tr>
                            `).join('') : `
                                <tr><td colspan="6" class="py-8 text-center text-gray-500">Chưa có key nào</td></tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Thông tin API -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">
                    <i class="fas fa-code mr-2"></i>API Endpoints cho Android Shell
                </h3>
                <div class="space-y-4">
                    <div>
                        <p class="text-sm text-gray-600 mb-2">Validate Key:</p>
                        <div class="bg-gray-800 text-gray-100 p-3 rounded-lg font-mono text-sm">
                            GET <span class="text-green-400">/api/validate/</span><span class="text-amber-300">{key}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Trả về: <code class="bg-gray-100 px-2 py-1 rounded">{"valid": true/false, "key": {...}}</code></p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 mb-2">Get Key Info:</p>
                        <div class="bg-gray-800 text-gray-100 p-3 rounded-lg font-mono text-sm">
                            GET <span class="text-green-400">/api/key-info/</span><span class="text-amber-300">{key}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('mainContent').innerHTML = html;
    } catch (error) {
        document.getElementById('mainContent').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>Lỗi tải dữ liệu
                </h3>
                <p class="text-red-600">${error.message}</p>
            </div>
        `;
    }
}

// Load key management
async function loadKeyManagement(page = 1) {
    currentPage = 'keys';
    currentKeyPage = page;
    updatePageTitle('Quản Lý Keys', 'Xem, chỉnh sửa và quản lý keys');
    
    try {
        incrementApiCall();
        const response = await fetch(`/api/keys?page=${page}&limit=20`);
        const data = await response.json();
        
        const html = `
            <!-- Filters -->
            <div class="bg-white rounded-xl shadow p-6 mb-6">
                <div class="flex flex-wrap gap-4">
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
                        <select id="filterStatus" onchange="filterKeys()" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            <option value="all">Tất cả</option>
                            <option value="active">Active</option>
                            <option value="locked">Locked</option>
                            <option value="deleted">Deleted</option>
                        </select>
                    </div>
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tìm kiếm</label>
                        <div class="relative">
                            <input type="text" id="filterSearch" placeholder="Tìm theo key, owner..." 
                                   oninput="filterKeys()"
                                   class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        </div>
                    </div>
                    <div class="flex items-end">
                        <button onclick="exportKeys()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition">
                            <i class="fas fa-download mr-2"></i>Export
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Keys Table -->
            <div class="bg-white rounded-xl shadow overflow-hidden mb-6">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">ID</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Key</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Owner</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Type</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Usage</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Expires</th>
                                <th class="py-3 px-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200" id="keysTableBody">
                            ${data.keys.map(key => `
                                <tr class="hover:bg-gray-50 border-l-4 ${getStatusBorderClass(key.status)}">
                                    <td class="py-3 px-4 font-mono text-sm">${key.id}</td>
                                    <td class="py-3 px-4">
                                        <div class="font-mono text-sm">
                                            <code class="bg-gray-100 px-2 py-1 rounded cursor-pointer hover:bg-gray-200" 
                                                  onclick="copyToClipboard('${key.key}')" 
                                                  title="Click để copy">
                                                ${key.key.length > 24 ? key.key.substring(0, 24) + '...' : key.key}
                                            </code>
                                        </div>
                                        ${key.description ? `
                                            <div class="text-xs text-gray-500 mt-1">${key.description}</div>
                                        ` : ''}
                                    </td>
                                    <td class="py-3 px-4">${key.owner || '<span class="text-gray-400">-</span>'}</td>
                                    <td class="py-3 px-4">
                                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${key.key_type}</span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(key.status)}">
                                            ${getStatusText(key.status)}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <div class="flex items-center space-x-2">
                                            <span class="font-semibold">${key.usage_count}</span>
                                            ${key.usage_limit > 0 ? `
                                                <div class="w-20 bg-gray-200 rounded-full h-2">
                                                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${Math.min(100, (key.usage_count / key.usage_limit) * 100)}%"></div>
                                                </div>
                                                <span class="text-xs text-gray-500">${key.usage_count}/${key.usage_limit}</span>
                                            ` : ''}
                                        </div>
                                    </td>
                                    <td class="py-3 px-4">
                                        ${key.expires_at ? `
                                            <div class="text-sm ${new Date(key.expires_at) < new Date() ? 'text-red-600' : 'text-gray-600'}">
                                                ${formatDate(key.expires_at)}
                                            </div>
                                            ${new Date(key.expires_at) < new Date() ? 
                                                '<div class="text-xs text-red-500">Expired</div>' : 
                                                '<div class="text-xs text-gray-500">' + daysUntil(key.expires_at) + ' days left</div>'
                                            }
                                        ` : '<span class="text-gray-400">Never</span>'}
                                    </td>
                                    <td class="py-3 px-4">
                                        <div class="flex space-x-1">
                                            <button onclick="viewKeyDetails(${key.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded" title="View">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            ${key.status !== 'active' ? `
                                                <button onclick="resetKey(${key.id})" class="p-2 text-green-600 hover:bg-green-50 rounded" title="Reset">
                                                    <i class="fas fa-redo"></i>
                                                </button>
                                            ` : ''}
                                            ${key.status !== 'locked' ? `
                                                <button onclick="lockKey(${key.id})" class="p-2 text-amber-600 hover:bg-amber-50 rounded" title="Lock">
                                                    <i class="fas fa-lock"></i>
                                                </button>
                                            ` : ''}
                                            ${key.status !== 'deleted' ? `
                                                <button onclick="deleteKey(${key.id})" class="p-2 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <!-- Pagination -->
                ${data.pagination.pages > 1 ? `
                    <div class="px-6 py-4 border-t border-gray-200">
                        <div class="flex justify-between items-center">
                            <div class="text-sm text-gray-700">
                                Hiển thị <span class="font-semibold">${(data.pagination.page - 1) * data.pagination.limit + 1}</span> 
                                đến <span class="font-semibold">${Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}</span> 
                                của <span class="font-semibold">${data.pagination.total}</span> keys
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="loadKeyManagement(${data.pagination.page - 1})" 
                                        ${data.pagination.page <= 1 ? 'disabled' : ''}
                                        class="px-3 py-1 border border-gray-300 rounded ${data.pagination.page <= 1 ? 'text-gray-400' : 'hover:bg-gray-50'}">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                
                                ${Array.from({ length: Math.min(5, data.pagination.pages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return `
                                        <button onclick="loadKeyManagement(${pageNum})"
                                                class="px-3 py-1 border rounded ${pageNum === data.pagination.page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}">
                                            ${pageNum}
                                        </button>
                                    `;
                                }).join('')}
                                
                                ${data.pagination.pages > 5 ? `
                                    <span class="px-3 py-1">...</span>
                                    <button onclick="loadKeyManagement(${data.pagination.pages})"
                                            class="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">
                                        ${data.pagination.pages}
                                    </button>
                                ` : ''}
                                
                                <button onclick="loadKeyManagement(${data.pagination.page + 1})" 
                                        ${data.pagination.page >= data.pagination.pages ? 'disabled' : ''}
                                        class="px-3 py-1 border border-gray-300 rounded ${data.pagination.page >= data.pagination.pages ? 'text-gray-400' : 'hover:bg-gray-50'}">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('mainContent').innerHTML = html;
    } catch (error) {
        document.getElementById('mainContent').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>Lỗi tải dữ liệu
                </h3>
                <p class="text-red-600">${error.message}</p>
            </div>
        `;
    }
}

// Load generate key form
async function loadGenerateKey() {
    currentPage = 'generate';
    updatePageTitle('Tạo Key Mới', 'Tạo API key mới với các tùy chọn nâng cao');
    
    const html = `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-xl shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-6">
                    <i class="fas fa-key mr-2"></i>Tạo API Key Mới
                </h3>
                
                <form id="generateForm" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Loại Key *</label>
                            <select name="key_type" required 
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                <option value="api_key">API Key</option>
                                <option value="access_token">Access Token</option>
                                <option value="license_key">License Key</option>
                                <option value="auth_token">Auth Token</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Tiền tố Key (Prefix)</label>
                            <input type="text" name="prefix" value="KEY" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                   placeholder="VD: API, KEY, LIC">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Chủ sở hữu</label>
                        <input type="text" name="owner" 
                               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                               placeholder="Tên người dùng hoặc ứng dụng">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Mô tả (tùy chọn)</label>
                        <textarea name="description" rows="3"
                                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                  placeholder="Mô tả mục đích sử dụng của key này"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Giới hạn sử dụng</label>
                            <input type="number" name="usage_limit" min="0" value="0"
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            <p class="text-xs text-gray-500 mt-1">0 = không giới hạn</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Thời hạn (ngày)</label>
                            <input type="number" name="expires_in_days" min="1" value="30"
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            <p class="text-xs text-gray-500 mt-1">Số ngày trước khi hết hạn</p>
                        </div>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div class="border-t border-gray-200 pt-6">
                        <div class="flex items-center mb-4 cursor-pointer" onclick="toggleAdvanced()">
                            <i class="fas fa-cog text-gray-400 mr-2"></i>
                            <span class="text-sm font-medium text-gray-700">Tùy chọn nâng cao</span>
                            <i id="advancedArrow" class="fas fa-chevron-down ml-auto transition-transform"></i>
                        </div>
                        
                        <div id="advancedOptions" class="hidden space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">IP Whitelist (tùy chọn)</label>
                                <input type="text" name="ip_whitelist" 
                                       class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                       placeholder="192.168.1.1, 10.0.0.0/24 (phân cách bằng dấu phẩy)">
                                <p class="text-xs text-gray-500 mt-1">Chỉ cho phép từ các IP này</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Metadata JSON (tùy chọn)</label>
                                <textarea name="metadata" rows="2"
                                          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                                          placeholder='{"app": "myapp", "version": "1.0"}'></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <div class="pt-6">
                        <button type="submit" id="generateBtn"
                                class="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center">
                            <i class="fas fa-magic mr-2"></i>
                            <span id="generateText">Tạo Key Ngay</span>
                            <span id="generateSpinner" class="hidden ml-2">
                                <i class="fas fa-spinner fa-spin"></i>
                            </span>
                        </button>
                    </div>
                </form>
                
                <!-- Generated Key Preview -->
                <div id="generatedKeyPreview" class="hidden mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-2">
                        <i class="fas fa-check-circle mr-2"></i>Key đã được tạo thành công!
                    </h4>
                    <div class="space-y-2">
                        <div>
                            <label class="text-sm text-gray-600">Key:</label>
                            <div class="mt-1">
                                <code id="generatedKeyValue" class="bg-gray-800 text-white p-3 rounded-lg font-mono text-sm block"></code>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm text-gray-600">ID:</label>
                                <p id="generatedKeyId" class="font-semibold"></p>
                            </div>
                            <div>
                                <label class="text-sm text-gray-600">Expires:</label>
                                <p id="generatedKeyExpires" class="font-semibold"></p>
                            </div>
                        </div>
                        <button onclick="copyGeneratedKey()" class="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                            <i class="fas fa-copy mr-2"></i>Copy Key
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- API Usage Info -->
            <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h4 class="font-semibold text-blue-800 mb-3">
                    <i class="fas fa-info-circle mr-2"></i>Thông tin sử dụng
                </h4>
                <p class="text-sm text-blue-700">
                    Key sau khi tạo có thể được sử dụng ngay lập tức với API endpoint:
                    <code class="bg-blue-100 px-2 py-1 rounded text-xs">/api/validate/{key}</code>
                </p>
            </div>
        </div>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
    
    // Add form submit handler
    document.getElementById('generateForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btn = document.getElementById('generateBtn');
        const btnText = document.getElementById('generateText');
        const spinner = document.getElementById('generateSpinner');
        
        // Show loading
        btn.disabled = true;
        btnText.textContent = 'Đang tạo...';
        spinner.classList.remove('hidden');
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        // Parse metadata if provided
        if (data.metadata) {
            try {
                data.metadata = JSON.parse(data.metadata);
            } catch {
                data.metadata = null;
            }
        }
        
        try {
            incrementApiCall();
            const response = await fetch('/api/keys/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Show generated key
                document.getElementById('generatedKeyValue').textContent = result.key.key;
                document.getElementById('generatedKeyId').textContent = result.key.id;
                document.getElementById('generatedKeyExpires').textContent = formatDate(result.key.expires_at);
                document.getElementById('generatedKeyPreview').classList.remove('hidden');
                
                // Reset form
                this.reset();
            } else {
                alert('❌ Lỗi: ' + result.error);
            }
        } catch (error) {
            alert('❌ Lỗi kết nối đến server');
        } finally {
            // Reset button
            btn.disabled = false;
            btnText.textContent = 'Tạo Key Ngay';
            spinner.classList.add('hidden');
        }
    });
}

// Load batch generate
async function loadBatchGenerate() {
    currentPage = 'batch';
    updatePageTitle('Tạo Keys Hàng Loạt', 'Tạo nhiều keys cùng lúc');
    
    const html = `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-xl shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-6">
                    <i class="fas fa-copy mr-2"></i>Tạo Keys Hàng Loạt
                </h3>
                
                <form id="batchForm" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Số lượng Keys *</label>
                            <input type="number" name="count" min="1" max="100" value="10" required
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            <p class="text-xs text-gray-500 mt-1">Tối đa 100 keys/lần</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Loại Key</label>
                            <select name="key_type"
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                <option value="api_key">API Key</option>
                                <option value="license_key">License Key</option>
                                <option value="access_token">Access Token</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tiền tố (Prefix)</label>
                        <input type="text" name="prefix" value="BATCH" 
                               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                               placeholder="VD: BATCH, LICENSE, TOKEN">
                    </div>
                    
                    <div class="pt-4">
                        <button type="submit" id="batchBtn"
                                class="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 flex items-center justify-center">
                            <i class="fas fa-layer-group mr-2"></i>
                            <span id="batchText">Tạo Hàng Loạt</span>
                            <span id="batchSpinner" class="hidden ml-2">
                                <i class="fas fa-spinner fa-spin"></i>
                            </span>
                        </button>
                    </div>
                </form>
                
                <!-- Generated Keys List -->
                <div id="batchResults" class="hidden mt-8">
                    <h4 class="font-semibold text-gray-800 mb-4">
                        <i class="fas fa-list mr-2"></i>Keys Đã Tạo (<span id="batchCount">0</span>)
                    </h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto" id="batchKeysList">
                        <!-- Keys will be listed here -->
                    </div>
                    <div class="mt-4">
                        <button onclick="downloadBatchKeys()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                            <i class="fas fa-download mr-2"></i>Tải Xuống CSV
                        </button>
                        <button onclick="copyBatchKeys()" class="ml-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                            <i class="fas fa-copy mr-2"></i>Copy Tất Cả
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
    
    // Add form submit handler
    document.getElementById('batchForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btn = document.getElementById('batchBtn');
        const btnText = document.getElementById('batchText');
        const spinner = document.getElementById('batchSpinner');
        
        // Show loading
        btn.disabled = true;
        btnText.textContent = 'Đang tạo...';
        spinner.classList.remove('hidden');
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        try {
            incrementApiCall();
            const response = await fetch('/api/keys/batch-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Show results
                document.getElementById('batchCount').textContent = result.generated;
                
                let keysList = '';
                result.keys.forEach(key => {
                    keysList += `
                        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <code class="font-mono text-sm">${key.key}</code>
                            <button onclick="copyToClipboard('${key.key}')" class="text-blue-600 hover:text-blue-800">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    `;
                });
                
                document.getElementById('batchKeysList').innerHTML = keysList;
                document.getElementById('batchResults').classList.remove('hidden');
            } else {
                alert('❌ Lỗi: ' + result.error);
            }
        } catch (error) {
            alert('❌ Lỗi kết nối đến server');
        } finally {
            // Reset button
            btn.disabled = false;
            btnText.textContent = 'Tạo Hàng Loạt';
            spinner.classList.add('hidden');
        }
    });
}

// Load statistics
async function loadStats() {
    currentPage = 'stats';
    updatePageTitle('Thống Kê & Báo Cáo', 'Phân tích sử dụng keys');
    
    try {
        incrementApiCall();
        const response = await fetch('/api/keys/stats');
        const data = await response.json();
        
        // Calculate percentages
        const totalKeys = data.total.total_keys || 1;
        const activeCount = data.stats.find(s => s.status === 'active')?.count || 0;
        const lockedCount = data.stats.find(s => s.status === 'locked')?.count || 0;
        const deletedCount = data.stats.find(s => s.status === 'deleted')?.count || 0;
        
        const html = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <!-- Summary Stats -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-xl shadow p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-6">
                            <i class="fas fa-chart-pie mr-2"></i>Phân Bổ Keys Theo Trạng Thái
                        </h3>
                        <div class="flex items-center justify-center">
                            <div class="relative w-64 h-64">
                                <!-- Pie Chart using CSS -->
                                <div class="absolute inset-0">
                                    <!-- Active -->
                                    <div class="absolute inset-0 rounded-full border-8 border-green-500" 
                                         style="clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);"></div>
                                    <!-- Locked -->
                                    <div class="absolute inset-0 rounded-full border-8 border-amber-500" 
                                         style="clip-path: polygon(50% 50%, 100% 0, 100% 100%, 50% 50%); 
                                                transform: rotate(${activeCount/totalKeys * 360}deg);"></div>
                                    <!-- Deleted -->
                                    <div class="absolute inset-0 rounded-full border-8 border-red-500" 
                                         style="clip-path: polygon(50% 50%, 100% 100%, 0 100%, 50% 50%); 
                                                transform: rotate(${(activeCount+lockedCount)/totalKeys * 360}deg);"></div>
                                </div>
                            </div>
                            
                            <div class="ml-8 space-y-4">
                                ${data.stats.map(stat => `
                                    <div class="flex items-center">
                                        <div class="w-4 h-4 rounded-full ${getStatusColor(stat.status)} mr-3"></div>
                                        <div class="flex-1">
                                            <div class="flex justify-between">
                                                <span class="text-gray-700">${getStatusText(stat.status)}</span>
                                                <span class="font-semibold">${stat.count}</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                <div class="h-2 rounded-full ${getStatusColor(stat.status)}" 
                                                     style="width: ${(stat.count/totalKeys)*100}%"></div>
                                            </div>
                                            <div class="text-xs text-gray-500 mt-1">
                                                ${Math.round((stat.count/totalKeys)*100)}% • ${stat.total_usage} lượt dùng
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Stats -->
                <div class="space-y-6">
                    <div class="bg-white rounded-xl shadow p-6">
                        <h4 class="font-semibold text-gray-800 mb-4">
                            <i class="fas fa-tachometer-alt mr-2"></i>Tổng Quan
                        </h4>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Tổng Keys:</span>
                                <span class="font-bold">${data.total.total_keys}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Tổng Lượt Dùng:</span>
                                <span class="font-bold">${data.total.total_usage_all}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Trung Bình/Key:</span>
                                <span class="font-bold">${Math.round(data.total.avg_usage)}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Tỷ Lệ Active:</span>
                                <span class="font-bold">${Math.round((activeCount/totalKeys)*100)}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow p-6">
                        <h4 class="font-semibold text-gray-800 mb-4">
                            <i class="fas fa-bolt mr-2"></i>Hoạt Động Gần Đây
                        </h4>
                        <div class="text-center py-4">
                            <i class="fas fa-history text-3xl text-gray-300 mb-2"></i>
                            <p class="text-gray-500">Tính năng đang phát triển</p>
                            <p class="text-xs text-gray-400 mt-1">Logs chi tiết sắp có</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Usage Trends -->
            <div class="bg-white rounded-xl shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-6">
                    <i class="fas fa-chart-line mr-2"></i>Xu Hướng Sử Dụng
                </h3>
                <div class="text-center py-8">
                    <i class="fas fa-chart-area text-4xl text-gray-300 mb-3"></i>
                    <p class="text-gray-600">Biểu đồ phân tích nâng cao sẽ được thêm trong phiên bản tiếp theo</p>
                    <p class="text-sm text-gray-400 mt-2">Hiện tại bạn có thể xem thống kê cơ bản ở trên</p>
                </div>
            </div>
        `;
        
        document.getElementById('mainContent').innerHTML = html;
    } catch (error) {
        document.getElementById('mainContent').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 class="text-lg font-semibold text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>Lỗi tải thống kê
                </h3>
                <p class="text-red-600">${error.message}</p>
            </div>
        `;
    }
}

// Load API documentation
async function loadApiDocs() {
    currentPage = 'docs';
    updatePageTitle('API Documentation', 'Tài liệu sử dụng API');
    
    const html = `
        <div class="max-w-4xl mx-auto">
            <div class="bg-white rounded-xl shadow p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-6">
                    <i class="fas fa-book mr-2"></i>Tài Liệu API
                </h3>
                
                <div class="space-y-8">
                    <!-- API Overview -->
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                            <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                            Tổng Quan API
                        </h4>
                        <p class="text-gray-600 mb-4">
                            Hệ thống cung cấp hai loại API: <strong>Public API</strong> cho ứng dụng client (như Shell Script Android) 
                            và <strong>Admin API</strong> (yêu cầu xác thực) cho quản lý.
                        </p>
                        <div class="bg-gray-800 text-gray-100 p-4 rounded-lg font-mono text-sm">
                            <span class="text-green-400">BASE URL:</span> https://your-app.onrender.com
                        </div>
                    </div>
                    
                    <!-- Public API -->
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                            <i class="fas fa-unlock text-green-500 mr-2"></i>
                            Public API (Không cần xác thực)
                        </h4>
                        
                        <div class="space-y-4">
                            <!-- Validate Key -->
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                    <div class="flex items-center">
                                        <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded mr-3">GET</span>
                                        <code class="text-sm">/api/validate/{key}</code>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <p class="text-gray-600 mb-3">Xác thực key và tăng bộ đếm lượt dùng.</p>
                                    <div class="mb-3">
                                        <span class="text-sm font-medium text-gray-700">Parameters:</span>
                                        <ul class="text-sm text-gray-600 mt-1 list-disc list-inside">
                                            <li><code>{key}</code> - API key cần xác thực</li>
                                        </ul>
                                    </div>
                                    <div class="mb-3">
                                        <span class="text-sm font-medium text-gray-700">Response (success):</span>
                                        <pre class="mt-1 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
{
  "valid": true,
  "key": {
    "id": 123,
    "owner": "John Doe",
    "usage_count": 5,
    "usage_limit": 100,
    "expires_at": "2024-12-31T23:59:59.000Z"
  }
}</pre>
                                    </div>
                                    <div>
                                        <span class="text-sm font-medium text-gray-700">Response (error):</span>
                                        <pre class="mt-1 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
{
  "valid": false,
  "error": "Key không hợp lệ hoặc đã hết hạn"
}</pre>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Get Key Info -->
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                    <div class="flex items-center">
                                        <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded mr-3">GET</span>
                                        <code class="text-sm">/api/key-info/{key}</code>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <p class="text-gray-600 mb-3">Lấy thông tin key (không tăng bộ đếm).</p>
                                    <div>
                                        <span class="text-sm font-medium text-gray-700">CURL Example:</span>
                                        <pre class="mt-1 p-3 bg-gray-800 text-gray-100 rounded text-xs overflow-x-auto">
curl -X GET "https://your-app.onrender.com/api/key-info/KEY_ABC123"</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Admin API -->
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                            <i class="fas fa-lock text-amber-500 mr-2"></i>
                            Admin API (Yêu cầu xác thực)
                        </h4>
                        <p class="text-gray-600 mb-4">
                            Tất cả Admin API yêu cầu session authentication (đăng nhập qua dashboard).
                        </p>
                        
                        <div class="space-y-4">
                            <!-- List Keys -->
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <div class="flex items-center">
                                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded mr-3">GET</span>
                                        <code class="text-sm">/api/keys</code>
                                    </div>
                                    <span class="text-xs text-gray-500">Quản lý key</span>
                                </div>
                                <div class="p-4">
                                    <p class="text-gray-600 mb-3">Lấy danh sách keys với phân trang và filter.</p>
                                    <div class="mb-3">
                                        <span class="text-sm font-medium text-gray-700">Query Parameters:</span>
                                        <ul class="text-sm text-gray-600 mt-1 list-disc list-inside">
                                            <li><code>page</code> - Trang số (mặc định: 1)</li>
                                            <li><code>limit</code> - Số lượng/trang (mặc định: 20)</li>
                                            <li><code>status</code> - Lọc theo trạng thái</li>
                                            <li><code>search</code> - Tìm kiếm theo key, owner</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Generate Key -->
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <div class="flex items-center">
                                        <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded mr-3">POST</span>
                                        <code class="text-sm">/api/keys/generate</code>
                                    </div>
                                    <span class="text-xs text-gray-500">Tạo key mới</span>
                                </div>
                                <div class="p-4">
                                    <div class="mb-3">
                                        <span class="text-sm font-medium text-gray-700">Request Body:</span>
                                        <pre class="mt-1 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
{
  "key_type": "api_key",
  "owner": "John Doe",
  "description": "Key cho ứng dụng Android",
  "usage_limit": 100,
  "expires_in_days": 30
}</pre>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- More APIs -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="border border-gray-200 rounded-lg p-4">
                                    <div class="flex items-center mb-2">
                                        <span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded mr-2">PUT</span>
                                        <code class="text-sm">/api/keys/{id}</code>
                                    </div>
                                    <p class="text-xs text-gray-600">Cập nhật thông tin key</p>
                                </div>
                                
                                <div class="border border-gray-200 rounded-lg p-4">
                                    <div class="flex items-center mb-2">
                                        <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded mr-2">POST</span>
                                        <code class="text-sm">/api/keys/{id}/reset</code>
                                    </div>
                                    <p class="text-xs text-gray-600">Reset key về trạng thái active</p>
                                </div>
                                
                                <div class="border border-gray-200 rounded-lg p-4">
                                    <div class="flex items-center mb-2">
                                        <span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded mr-2">POST</span>
                                        <code class="text-sm">/api/keys/{id}/lock</code>
                                    </div>
                                    <p class="text-xs text-gray-600">Khóa key</p>
                                </div>
                                
                                <div class="border border-gray-200 rounded-lg p-4">
                                    <div class="flex items-center mb-2">
                                        <span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded mr-2">DELETE</span>
                                        <code class="text-sm">/api/keys/{id}</code>
                                    </div>
                                    <p class="text-xs text-gray-600">Xóa key (soft delete)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Android Shell Example -->
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                            <i class="fas fa-android text-green-500 mr-2"></i>
                            Ví dụ cho Android Shell Script
                        </h4>
                        <div class="bg-gray-900 text-gray-100 p-4 rounded-lg">
                            <pre class="text-sm overflow-x-auto">
#!/bin/bash

KEY="YOUR_API_KEY_HERE"
API_URL="https://your-app.onrender.com/api/validate/$KEY"

# Gọi API validate
response=$(curl -s -X GET "$API_URL")

# Parse JSON response
valid=$(echo $response | grep -o '"valid":[^,]*' | cut -d':' -f2)

if [ "$valid" = "true" ]; then
    echo "✅ Key hợp lệ"
    
    # Lấy thông tin từ response
    owner=$(echo $response | grep -o '"owner":"[^"]*"' | cut -d'"' -f4)
    usage_count=$(echo $response | grep -o '"usage_count":[^,]*' | cut -d':' -f2)
    
    echo "👤 Owner: $owner"
    echo "📊 Usage: $usage_count"
    
    # Tiếp tục thực thi script của bạn...
else
    echo "❌ Key không hợp lệ"
    error=$(echo $response | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "Error: $error"
    exit 1
fi</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
}

// ========== HELPER FUNCTIONS ==========

function updatePageTitle(title, subtitle) {
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;
    
    // Update active menu
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('bg-blue-800', 'text-white');
        link.classList.add('hover:bg-gray-800', 'text-gray-300', 'hover:text-white');
    });
    
    // Set active based on currentPage
    let activeSelector = '';
    switch(currentPage) {
        case 'dashboard': activeSelector = 'nav a:nth-child(1)'; break;
        case 'keys': activeSelector = 'nav a:nth-child(2)'; break;
        case 'generate': activeSelector = 'nav a:nth-child(3)'; break;
        case 'batch': activeSelector = 'nav a:nth-child(4)'; break;
        case 'stats': activeSelector = 'nav a:nth-child(5)'; break;
        case 'docs': activeSelector = 'nav a:nth-child(6)'; break;
    }
    
    const activeLink = document.querySelector(activeSelector);
    if (activeLink) {
        activeLink.classList.add('bg-blue-800', 'text-white');
        activeLink.classList.remove('hover:bg-gray-800', 'text-gray-300', 'hover:text-white');
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'active': return 'bg-green-100 text-green-800';
        case 'locked': return 'bg-amber-100 text-amber-800';
        case 'deleted': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getStatusBorderClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'locked': return 'status-locked';
        case 'deleted': return 'status-deleted';
        default: return 'status-pending';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'active': return 'Active';
        case 'locked': return 'Locked';
        case 'deleted': return 'Deleted';
        default: return status;
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'active': return 'bg-green-500';
        case 'locked': return 'bg-amber-500';
        case 'deleted': return 'bg-red-500';
        default: return 'bg-gray-500';
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
}

function daysUntil(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Đã copy vào clipboard!', 'success');
    } catch (err) {
        showToast('Lỗi khi copy', 'error');
    }
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.getElementById('globalToast');
    if (existingToast) existingToast.remove();
    
    // Create toast
    const toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50 transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== KEY ACTIONS ==========

async function viewKeyDetails(keyId) {
    try {
        incrementApiCall();
        const response = await fetch(`/api/keys/${keyId}/logs`);
        const data = await response.json();
        
        if (data.success) {
            let logsHtml = '';
            if (data.logs.length > 0) {
                logsHtml = data.logs.map(log => `
                    <div class="border-b border-gray-200 last:border-0 py-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="font-medium">${log.action}</span>
                                <div class="text-xs text-gray-500 mt-1">${formatDate(log.created_at)}</div>
                            </div>
                            <span class="text-xs text-gray-400">${log.ip_address || 'N/A'}</span>
                        </div>
                        ${log.details ? `
                            <div class="mt-2 text-sm">
                                <details>
                                    <summary class="cursor-pointer text-blue-600">Details</summary>
                                    <pre class="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">${JSON.stringify(JSON.parse(log.details), null, 2)}</pre>
                                </details>
                            </div>
                        ` : ''}
                    </div>
                `).join('');
            } else {
                logsHtml = '<div class="text-center py-4 text-gray-500">No logs found</div>';
            }
            
            showModal(`
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Key Logs</h3>
                <div class="max-h-96 overflow-y-auto">
                    ${logsHtml}
                </div>
            `);
        }
    } catch (error) {
        showToast('Lỗi khi tải logs', 'error');
    }
}

async function resetKey(keyId) {
    if (!confirm('Reset key này về trạng thái active và đặt lượt dùng về 0?')) return;
    
    try {
        incrementApiCall();
        const response = await fetch(`/api/keys/${keyId}/reset`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Key đã được reset', 'success');
            if (currentPage === 'keys') loadKeyManagement(currentKeyPage);
            else loadDashboard();
        }
    } catch (error) {
        showToast('Lỗi khi reset key', 'error');
    }
}

async function lockKey(keyId) {
    if (!confirm('Khóa key này? Key sẽ không thể sử dụng cho đến khi được reset.')) return;
    
    try {
        incrementApiCall();
        const response = await fetch(`/api/keys/${keyId}/lock`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Key đã bị khóa', 'success');
            if (currentPage === 'keys') loadKeyManagement(currentKeyPage);
            else loadDashboard();
        }
    } catch (error) {
        showToast('Lỗi khi khóa key', 'error');
    }
}

async function deleteKey(keyId) {
    if (!confirm('Đánh dấu key này là đã xóa? Bạn có thể reset để khôi phục sau.')) return;
    
    try {
        incrementApiCall();
        const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Key đã bị xóa', 'success');
            if (currentPage === 'keys') loadKeyManagement(currentKeyPage);
            else loadDashboard();
        }
    } catch (error) {
        showToast('Lỗi khi xóa key', 'error');
    }
}

// ========== UTILITIES ==========

function toggleAdvanced() {
    const options = document.getElementById('advancedOptions');
    const arrow = document.getElementById('advancedArrow');
    
    if (options.classList.contains('hidden')) {
        options.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        options.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function copyGeneratedKey() {
    const key = document.getElementById('generatedKeyValue').textContent;
    copyToClipboard(key);
}

function copyBatchKeys() {
    const keyElements = document.querySelectorAll('#batchKeysList code');
    const keys = Array.from(keyElements).map(el => el.textContent).join('\n');
    copyToClipboard(keys);
}

function downloadBatchKeys() {
    const keyElements = document.querySelectorAll('#batchKeysList code');
    const keys = Array.from(keyElements).map(el => el.textContent);
    
    let csv = 'Key,Type\n';
    keys.forEach(key => {
        csv += `${key},api_key\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keys_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function filterKeys() {
    // This would filter the displayed keys without reloading
    // For now, just reload with filters
    const status = document.getElementById('filterStatus')?.value || 'all';
    const search = document.getElementById('filterSearch')?.value || '';
    loadKeyManagement(1);
}

function exportKeys() {
    showToast('Tính năng export đang được phát triển', 'info');
}

function showModal(content) {
    // Remove existing modal
    const existingModal = document.getElementById('globalModal');
    if (existingModal) existingModal.remove();
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'globalModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-800"></h3>
                <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                ${content}
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition">
                    Đóng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('globalModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add global search handler
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (currentPage === 'keys') {
                    filterKeys();
                } else {
                    loadKeyManagement(1);
                }
            }
        });
    }
});
