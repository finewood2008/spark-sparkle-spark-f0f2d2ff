import { useState } from 'react';
import { Settings, Save, Image as ImageIcon, MessageSquare } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-2.5-flash',
    imageProvider: 'gemini-imagen',
    imageApiKey: '',
    imageModel: 'imagen-3.0-generate-images',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 600);
  };

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-spark-gray-800 mb-1 flex items-center gap-2">
        <Settings size={20} className="text-spark-orange" />
        系统设置
      </h1>
      <p className="text-sm text-spark-gray-400 mb-6">配置 AI 引擎和图像生成服务</p>

      {/* Text Model */}
      <div className="spark-card p-5 mb-4">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-4 flex items-center gap-2">
          <MessageSquare size={16} className="text-spark-orange" />
          文本引擎配置
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-spark-gray-500 mb-1 block">服务商</label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
              className="spark-input"
            >
              <option value="gemini">Google Gemini (直连/代理)</option>
              <option value="vveai">vveai 中转</option>
              <option value="custom">自定义 (OpenAI 兼容)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-spark-gray-500 mb-1 block">API Key</label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              className="spark-input"
              placeholder="AIzaSy..."
            />
          </div>
          {settings.provider === 'custom' && (
            <div>
              <label className="text-xs text-spark-gray-500 mb-1 block">Base URL</label>
              <input
                value={settings.baseUrl}
                onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                className="spark-input"
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-spark-gray-500 mb-1 block">模型</label>
            <input
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              className="spark-input"
            />
          </div>
        </div>
      </div>

      {/* Image Model */}
      <div className="spark-card p-5 mb-6">
        <h2 className="font-semibold text-sm text-spark-gray-700 mb-4 flex items-center gap-2">
          <ImageIcon size={16} className="text-spark-orange" />
          图像引擎配置
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-spark-gray-500 mb-1 block">服务商</label>
            <select
              value={settings.imageProvider}
              onChange={(e) => setSettings({ ...settings, imageProvider: e.target.value })}
              className="spark-input"
            >
              <option value="gemini-imagen">Google Imagen</option>
              <option value="openai-dalle">OpenAI DALL·E</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-spark-gray-500 mb-1 block">API Key</label>
            <input
              type="password"
              value={settings.imageApiKey}
              onChange={(e) => setSettings({ ...settings, imageApiKey: e.target.value })}
              className="spark-input"
              placeholder="API Key..."
            />
          </div>
          <div>
            <label className="text-xs text-spark-gray-500 mb-1 block">模型</label>
            <input
              value={settings.imageModel}
              onChange={(e) => setSettings({ ...settings, imageModel: e.target.value })}
              className="spark-input"
            />
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="spark-btn-primary" disabled={saving}>
        <Save size={16} />
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}
