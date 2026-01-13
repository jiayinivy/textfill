// 用于展示插件用户界面
console.log('插件初始化开始...');
mg.showUI(__html__)
console.log('插件UI已显示');

// 调用Vercel代理API生成文本
const PROXY_URL = 'https://textfill-ten.vercel.app/api/qwen-proxy';

async function callQwenAPI(description, count) {
    try {
        console.log('开始调用代理API:', PROXY_URL);
        console.log('请求参数:', { description, count });
        
        const requestBody = {
            description: description,
            count: count
        };
        
        console.log('发送请求...');
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('收到响应:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API响应错误:', response.status, errorText);
            let errorData = {};
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText };
            }
            throw new Error(errorData.error || `API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API返回数据:', data);
        
        if (!data.success || !data.texts || !Array.isArray(data.texts)) {
            throw new Error(data.error || 'API返回数据格式错误');
        }
        
        if (data.texts.length < count) {
            throw new Error(`生成的文本数量不足，需要${count}个，实际生成${data.texts.length}个`);
        }
        
        console.log('成功获取文本:', data.texts);
        return data.texts;
    } catch (error) {
        console.error('调用代理API失败:', error);
        console.error('错误详情:', error.message, error.stack);
        throw error;
    }
}

// 获取选中的文字图层
function getSelectedTextLayers() {
    try {
        // 尝试不同的API方式获取选中图层
        let selection = [];
        
        if (mg.currentPage && mg.currentPage.selection) {
            selection = mg.currentPage.selection;
        } else if (mg.selection) {
            selection = mg.selection;
        } else {
            // 如果以上都不存在，尝试使用其他方式
            selection = [];
        }
        
        // 筛选出文字图层
        const textLayers = selection.filter(node => {
            return node && (node.type === 'TEXT' || node.type === 'text' || node.characters !== undefined);
        });
        
        return textLayers;
    } catch (error) {
        console.error('获取选中图层失败:', error);
        return [];
    }
}

// 替换文字图层内容
function replaceTextLayerContent(layer, text) {
    try {
        if (layer.characters !== undefined) {
            layer.characters = text;
        } else if (layer.setText) {
            layer.setText(text);
        } else if (layer.text) {
            layer.text = text;
        } else {
            throw new Error('无法修改文字图层内容');
        }
    } catch (error) {
        console.error('替换文字图层内容失败:', error);
        throw error;
    }
}

// 接收来自 UI 的消息
console.log('设置消息监听器...');
mg.ui.onmessage = async (msg) => {
    console.log('收到UI消息:', msg);
    if (msg.type === 'submit') {
        console.log('处理提交请求，描述:', msg.text);
        const description = msg.text;
        
        // 发送加载状态
        mg.ui.postMessage({ type: 'loading', message: '正在处理...' });
        
        try {
            // 1. 获取选中的文字图层
            const textLayers = getSelectedTextLayers();
            
            if (textLayers.length === 0) {
                mg.ui.postMessage({ type: 'error', message: '请先选中文字图层' });
                if (mg.notify) {
                    mg.notify('请先选中文字图层');
                }
                return;
            }
            
            const count = textLayers.length;
            
            // 2. 调用阿里云千问API生成文本
            console.log('准备调用API，选中图层数量:', count);
            mg.ui.postMessage({ type: 'loading', message: `正在生成${count}个文本...` });
            
            console.log('开始调用 callQwenAPI...');
            const generatedTexts = await callQwenAPI(description, count);
            console.log('API调用完成，返回文本:', generatedTexts);
            
            // 3. 替换文字图层内容
            for (let i = 0; i < textLayers.length && i < generatedTexts.length; i++) {
                replaceTextLayerContent(textLayers[i], generatedTexts[i]);
            }
            
            // 4. 发送成功消息
            mg.ui.postMessage({ type: 'success', message: `成功填充${generatedTexts.length}个文字图层` });
            if (mg.notify) {
                mg.notify(`成功填充${generatedTexts.length}个文字图层`);
            }
            
        } catch (error) {
            const errorMessage = error.message || '处理失败，请重试';
            mg.ui.postMessage({ type: 'error', message: errorMessage });
            if (mg.notify) {
                mg.notify(errorMessage);
            }
            console.error('处理失败:', error);
        }
    }
}