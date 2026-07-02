import React, { useState, useEffect } from 'react';
import { Mail, Send, RefreshCw, Search, Inbox, Plus, FileText, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getWorkspaceToken, getWorkspaceUserEmail, connectGmailAccount, disconnectGmailAccount } from '../lib/workspaceAuth';
import { notify } from '../lib/notifications';

interface EmailType {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
}

export default function Gmail() {
  const [token, setToken] = useState<string | null>(getWorkspaceToken());
  const [gmailUserEmail, setGmailUserEmail] = useState<string | null>(getWorkspaceUserEmail());
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<EmailType[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState<'INBOX' | 'SENT'>('INBOX');

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (token) {
      fetchEmails();
    }
  }, [token, currentFolder]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      const res = await connectGmailAccount();
      if (res) {
        setToken(res.accessToken);
        setGmailUserEmail(res.email);
        notify.success('تم ربط حساب Gmail بنجاح 📧');
      }
    } catch (err: any) {
      console.error(err);
      notify.error('فشل ربط الحساب: ' + (err.message || 'خطأ'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGmailAccount();
    setToken(null);
    setGmailUserEmail(null);
    setEmails([]);
    setSelectedEmail(null);
    notify.success('تم قطع الاتصال بحساب Gmail');
  };

  const decodeBase64UTF8 = (b64: string): string => {
    try {
      const cleaned = b64.replace(/-/g, '+').replace(/_/g, '/');
      return new TextDecoder('utf-8').decode(new Uint8Array(atob(cleaned).split('').map(c => c.charCodeAt(0))));
    } catch {
      return '';
    }
  };

  const parseMessageDetails = (msg: any): EmailType => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    let body = '';
    if (msg.payload?.body?.data) {
      body = decodeBase64UTF8(msg.payload.body.data);
    } else if (msg.payload?.parts) {
      const findBody = (parts: any[]): string => {
        for (const part of parts) {
          if (part.mimeType === 'text/html' && part.body?.data) return decodeBase64UTF8(part.body.data);
        }
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64UTF8(part.body.data);
        }
        for (const part of parts) {
          if (part.parts) {
            const res = findBody(part.parts);
            if (res) return res;
          }
        }
        return '';
      };
      body = findBody(msg.payload.parts);
    }
    return {
      id: msg.id,
      from: getHeader('from'),
      to: getHeader('to'),
      subject: getHeader('subject') || '(بدون عنوان)',
      date: getHeader('date'),
      snippet: msg.snippet || '',
      body: body || msg.snippet || ''
    };
  };

  const fetchEmails = async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10`;
      if (currentFolder === 'SENT') url += `&q=from:me`;
      else url += `&q=label:INBOX`;

      if (searchQuery.trim()) url += ` ${searchQuery}`;

      const resList = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resList.ok) {
        if (resList.status === 401) handleDisconnect();
        throw new Error('Unauthorized');
      }

      const listData = await resList.json();
      const raw = listData.messages || [];
      if (raw.length === 0) {
        setEmails([]);
        return;
      }

      const detailPromises = raw.map(async (msg: any) => {
        const resDetail = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resDetail.ok) return parseMessageDetails(await resDetail.json());
        return null;
      });

      setEmails(((await Promise.all(detailPromises)).filter(Boolean) as EmailType[]));
    } catch (e) {
      console.error(e);
      notify.error('فشل تحميل الرسائل.');
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !composeTo.trim()) return;

    setSendingEmail(true);
    const toastId = notify.loading('جاري الإرسال...');
    try {
      const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(composeSubject)))}?=`;
      const wrapper = `
        <div style="font-family: Arial; direction: rtl; text-align: right; padding: 20px;">
          <h2 style="color: #541919; border-bottom: 2px solid #541919; padding-bottom: 5px;">الحسام فون</h2>
          <div style="font-size: 14px; margin-top: 15px;">${composeBody.replace(/\n/g, '<br/>')}</div>
        </div>
      `;
      const parts = [
        `To: ${composeTo}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        wrapper
      ];
      const raw = btoa(unescape(encodeURIComponent(parts.join('\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw })
      });

      if (!response.ok) throw new Error('Send failed');
      notify.dismiss(toastId);
      notify.success('تم إرسال بريدك الإلكتروني بنجاح!');
      setIsComposeOpen(false);
      if (currentFolder === 'SENT') fetchEmails();
    } catch (err) {
      notify.dismiss(toastId);
      notify.error('فشل إرسال البريد.');
    } finally {
      setSendingEmail(false);
    }
  };

  const applyTemplate = (type: 'invoice' | 'debt') => {
    if (type === 'invoice') {
      setComposeSubject('فاتورة مبيعات جديدة - متجر الحسام فون');
      setComposeBody(`شكرًا لتعاملكم معنا.
تم إرفاق تفاصيل فاتورة مبيعاتكم:
المبلغ الإجمالي مدفوع بالكامل.

إذا كان لديك أي استفسار، تواصل معنا: 776591639.`);
    } else {
      setComposeSubject('إشعار مديونية - متجر الحسام فون');
      setComposeBody(`الأخ الكريم،
نود تذكيركم بالمديونية القائمة المستحقة لمتجر الحسام فون. يرجى المراجعة للتسوية.

ممتنون لتعاونكم.`);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-lg font-black text-gray-900 dark:text-white">بريد Gmail</h1>
            <p className="text-xs text-gray-500 font-bold">إرسال واستقبال رسائل البريد الإلكتروني وتنبيهات الكاشير</p>
          </div>
        </div>
        {token ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg">{gmailUserEmail}</span>
            <button onClick={handleDisconnect} className="bg-red-50 text-red-650 text-xs px-3 py-1.5 rounded-lg font-bold border border-red-100 cursor-pointer">فصل بريد جوجل</button>
          </div>
        ) : (
          <button onClick={handleConnect} className="bg-primary text-white text-xs px-4 py-2 rounded-xl font-bold cursor-pointer border-none flex items-center gap-1">ربط بريد Gmail الآن 📧</button>
        )}
      </div>

      {token && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[550px]" id="gmail-workspace-container">
          <div className="lg:col-span-3 space-y-3 flex flex-col">
            <button onClick={() => { setIsComposeOpen(true); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }} className="w-full btn-primary text-xs font-black py-2.5 justify-center border-none">رسالة جديدة +</button>
            <div className="bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl p-2.5 flex flex-col gap-1">
              <button onClick={() => setCurrentFolder('INBOX')} className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold border-none cursor-pointer ${currentFolder === 'INBOX' ? 'bg-primary/5 text-primary' : 'text-gray-500 hover:bg-gray-50 bg-transparent'}`}>علبة الوارد</button>
              <button onClick={() => setCurrentFolder('SENT')} className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold border-none cursor-pointer ${currentFolder === 'SENT' ? 'bg-primary/5 text-primary' : 'text-gray-500 hover:bg-gray-50 bg-transparent'}`}>المرسل</button>
            </div>
            <div className="bg-amber-50/40 p-3.5 border border-amber-100 dark:bg-slate-900 dark:border-slate-800 rounded-2xl space-y-2">
              <span className="text-[10px] font-black text-amber-800 dark:text-amber-400">قوالب الصندوق السريعة</span>
              <button onClick={() => { setIsComposeOpen(true); applyTemplate('invoice'); }} className="w-full text-right bg-white dark:bg-slate-800 hover:bg-gray-50 text-[10px] p-2 rounded-lg border border-gray-150 cursor-pointer font-bold">📄 فاتورة مبيعات جديدة</button>
              <button onClick={() => { setIsComposeOpen(true); applyTemplate('debt'); }} className="w-full text-right bg-white dark:bg-slate-800 hover:bg-gray-50 text-[10px] p-2 rounded-lg border border-gray-150 cursor-pointer font-bold">🔔 إشعار مديونية مستحقة</button>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-2 border-b border-gray-150 flex gap-2 shrink-0">
              <input type="text" placeholder="بحث ورشح الرسائل..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchEmails()} className="w-full px-3 py-1.5 bg-gray-50 rounded-lg text-xs outline-none text-right" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-gray-100">
              {emails.map(email => (
                <div key={email.id} onClick={() => setSelectedEmail(email)} className={`p-3 cursor-pointer transition-colors ${selectedEmail?.id === email.id ? 'bg-primary/5 border-r-4 border-r-primary' : 'hover:bg-gray-50'}`}>
                  <div className="flex justify-between text-[10.5px] font-black text-secondary mb-1">
                    <span className="truncate max-w-[120px]">{email.from}</span>
                    <span className="font-mono text-gray-400">{(email.date || '').substring(0, 16)}</span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate mb-0.5">{email.subject}</h4>
                  <p className="text-[9.5px] text-gray-400 line-clamp-1">{email.snippet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl flex flex-col overflow-hidden p-4">
            {selectedEmail ? (
              <div className="flex flex-col h-full overflow-hidden" id="email-body-content">
                <div className="border-b border-gray-150 pb-3 shrink-0 mb-3">
                  <h3 className="text-xs md:text-sm font-black text-gray-900 dark:text-white leading-snug">{selectedEmail.subject}</h3>
                  <span className="text-[10px] text-gray-405 block mt-1">من: {selectedEmail.from}</span>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar text-xs leading-relaxed font-semibold">
                  {selectedEmail.body.includes('</') ? <div dangerouslySetInnerHTML={{ __html: selectedEmail.body }} /> : <p className="whitespace-pre-wrap">{selectedEmail.body}</p>}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs font-bold">اختر رسالة بريد إلكتروني لقراءتها بالكامل</div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isComposeOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div onClick={() => !sendingEmail && setIsComposeOpen(false)} className="absolute inset-0 bg-black/50" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 border border-gray-150 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-10 p-5 space-y-4">
              <h3 className="font-black text-sm text-primary">إنشاء بريد إلكتروني</h3>
              <input type="email" placeholder="بريد المستلم" value={composeTo} onChange={e => setComposeTo(e.target.value)} className="w-full text-left font-mono text-xs px-3 py-2 bg-gray-50 rounded-xl outline-none" required />
              <input type="text" placeholder="موضوع الرسالة" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs outline-none" required />
              <textarea placeholder="اكتب رسالتك لعميلك..." rows={5} value={composeBody} onChange={e => setComposeBody(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl text-xs outline-none resize-none leading-relaxed" required />
              <div className="grid grid-cols-2 gap-3">
                <button type="submit" onClick={sendEmail} disabled={sendingEmail} className="w-full btn-primary text-xs font-black py-2 cursor-pointer border-none justify-center">إرسال 🚀</button>
                <button type="button" onClick={() => setIsComposeOpen(false)} className="w-full bg-gray-150 text-gray-500 py-2 rounded-xl text-xs font-bold border hover:bg-gray-200">إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
