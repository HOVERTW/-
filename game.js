class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('找不到 canvas 元素');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('無法獲取 canvas 上下文');
            return;
        }

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.gameOver = false;
        this.score = 0;
        this.highScores = []; // 初始化為空陣列，將從 Supabase 獲取

        this.player = {
            x: this.width / 2,
            y: this.height / 2,
            width: 40,
            height: 50,
            speed: 2.5,
            maxSpeed: 5,
            acceleration: 0.125,
            velX: 0,
            velY: 0,
            jumpForce: -12,
            canJump: false,
            health: 100,
            invincibleTime: 0
        };

        this.gravity = 0.5;
        this.platformSpeed = 3.5;
        this.platforms = [];
        this.platformTypes = ['normal', 'spike'];
        this.damagedPlatforms = new Set();
        this.keys = { left: false, right: false, space: false };

        // 建立 DOM input 元素用於輸入名字
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = '請輸入你的名字';
        this.nameInput.style.position = 'absolute'; // 設置為絕對定位
        this.nameInput.style.fontSize = '20px'; // 確保與 style 標籤中一致或根據需要調整
        this.nameInput.style.padding = '10px';
        this.nameInput.style.display = 'none'; // 初始隱藏
        this.nameInput.maxLength = 15; // 限制名字長度 (可選)
        document.body.appendChild(this.nameInput);

        // 為名字輸入框綁定 Enter 事件
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.submitScore();
            }
        });

        this.initPlatforms();
        this.bindEvents();
        this.bindMobileControls();
        this.fetchHighScores(); // 遊戲開始時獲取排行榜
        this.gameLoop();
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                case 'a': // Adding A for left
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                case 'd': // Adding D for right
                    this.keys.right = true;
                    break;
                case ' ': // Space key
                case 'w': // Adding W for jump
                case 'ArrowUp': // Adding ArrowUp for jump
                    if (this.gameOver) {
                        this.restart();
                    } else if (this.player.canJump) {
                        this.player.velY = this.player.jumpForce;
                        this.player.canJump = false;
                    }
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                case 'a':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'd':
                    this.keys.right = false;
                    break;
            }
        });
    }

    bindMobileControls() {
        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnJump = document.getElementById('btnJump');

        if (!btnLeft || !btnRight || !btnJump) {
            console.warn('找不到手機控制按鈕，請檢查 index.html.');
            return;
        }

        const handleStart = (key) => (e) => {
            e.preventDefault();
            this.keys[key] = true;
        };

        const handleEnd = (key) => (e) => {
            e.preventDefault();
            this.keys[key] = false;
        };

        btnLeft.addEventListener('touchstart', handleStart('left'));
        btnLeft.addEventListener('touchend', handleEnd('left'));
        btnLeft.addEventListener('mousedown', handleStart('left'));
        btnLeft.addEventListener('mouseup', handleEnd('left'));


        btnRight.addEventListener('touchstart', handleStart('right'));
        btnRight.addEventListener('touchend', handleEnd('right'));
        btnRight.addEventListener('mousedown', handleStart('right'));
        btnRight.addEventListener('mouseup', handleEnd('right'));

        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameOver) {
                this.restart();
            } else if (this.player.canJump) {
                this.player.velY = this.player.jumpForce;
                this.player.canJump = false;
            }
        });
        btnJump.addEventListener('mousedown', (e) => { // For mouse click
            e.preventDefault();
            if (this.gameOver) {
                this.restart();
            } else if (this.player.canJump) {
                this.player.velY = this.player.jumpForce;
                this.player.canJump = false;
            }
        });
    }

    initPlatforms() {
        this.platforms = []; // Clear existing platforms
        this.platforms.push({
            x: this.width / 2 - 50,
            y: this.height / 2 + this.player.height + 100, // Start player a bit higher on a platform
            width: 100,
            height: 20,
            type: 'normal'
        });

        for (let i = 1; i < 7; i++) { // Increased initial platforms
            this.platforms.push({
                x: Math.random() * (this.width - 100),
                y: this.height - i * 120, // Spaced out more
                width: Math.random() * 50 + 80, // Random width
                height: 20,
                type: this.platformTypes[Math.floor(Math.random() * this.platformTypes.length)]
            });
        }
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height && // Collision from top/bottom
            rect1.y + rect1.height > rect2.y;
    }

    update() {
        if (this.gameOver) return;

        if (this.keys.left) {
            this.player.velX = Math.max(this.player.velX - this.player.acceleration, -this.player.maxSpeed);
        } else if (this.keys.right) {
            this.player.velX = Math.min(this.player.velX + this.player.acceleration, this.player.maxSpeed);
        } else {
            this.player.velX *= 0.85; // Slightly more friction
        }

        this.player.x += this.player.velX;
        this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));

        this.player.velY += this.gravity;
        this.player.y += this.player.velY;

        if (this.player.invincibleTime > 0) this.player.invincibleTime--;

        // let onPlatform = false; // This variable was not used, can be removed
        this.platforms.forEach(platform => {
            // Check collision only if player is falling and near the top of the platform
            if (this.player.velY >= 0 &&
                this.player.x < platform.x + platform.width &&
                this.player.x + this.player.width > platform.x &&
                this.player.y + this.player.height > platform.y &&
                this.player.y + this.player.height < platform.y + platform.height + this.player.velY //予測衝突
            ) {
                if (platform.type === 'spike' && this.player.invincibleTime <= 0 && !this.damagedPlatforms.has(platform)) {
                    this.player.health = Math.max(0, this.player.health - 34); // 3 hits to die
                    this.player.invincibleTime = 90; // 1.5 seconds invincibility
                    this.damagedPlatforms.add(platform); // Avoid instant re-damage on same spike
                    this.player.velY = this.player.jumpForce * 0.5; // Simple knockback effect
                }
                // Land on platform
                this.player.velY = 0;
                this.player.y = platform.y - this.player.height;
                this.player.canJump = true;
                // onPlatform = true; // This variable was not used
            }

            // Platforms move upwards (game scrolls down)
            if (this.player.y < this.height / 2.5) { // If player is high, scroll faster
                 platform.y -= (this.platformSpeed + (this.height / 2.5 - this.player.y) * 0.05);
            } else {
                platform.y -= this.platformSpeed;
            }

            if (platform.y < -platform.height) { // If platform is off-screen top
                this.score +=10; // Score for passing a platform
                this.damagedPlatforms.delete(platform); // Remove from damaged set if it goes off screen
            }
        });

        this.platforms = this.platforms.filter(p => p.y > -p.height - 10); // Filter platforms above screen

        // Add new platforms from the bottom
        if (this.platforms.length < 10) { // Maintain more platforms
            // const lastPlatform = this.platforms[this.platforms.length -1] || {y: this.height - 100}; // Not strictly needed for this logic
            // const newY = Math.max(lastPlatform.y + 100, this.height - 50 + Math.random()*50); // This logic seems a bit complex for simple spawn

            if (this.platforms.length === 0 || this.platforms[this.platforms.length - 1].y < this.height - 100) {
                 this.platforms.push({
                    x: Math.random() * (this.width - 100),
                    y: this.height + Math.random() * 50, // Start off-screen bottom
                    width: Math.random() * 50 + 70,
                    height: 20,
                    type: Math.random() < 0.2 ? 'spike' : 'normal' // 20% chance of spike
                });
            }
        }


        if (this.player.y > this.height + this.player.height || this.player.health <= 0) {
            if (!this.gameOver) { // Ensure this only runs once
                this.gameOver = true;
                this.showNameInput(); // Call to show name input
            }
        }

        if (!this.gameOver) this.score += 1; // Increase score over time
    }

    draw() {
        this.ctx.fillStyle = '#000033'; // Dark blue background
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.platforms.forEach(platform => {
            this.ctx.fillStyle = platform.type === 'spike' ? '#ff3333' : '#33ff33'; // Brighter colors
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            this.ctx.strokeStyle = '#ffffff'; // White border for platforms
            this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        });

        if (!(this.player.invincibleTime > 0 && Math.floor(this.player.invincibleTime / 6) % 2 === 0)) {
            this.drawPlayer();
        }

        this.drawUI();

        if (this.gameOver) {
            this.drawGameOver();
        }
    }

    drawPlayer() {
        const x = Math.floor(this.player.x);
        const y = Math.floor(this.player.y);
        const w = this.player.width;
        const h = this.player.height;

        this.ctx.fillStyle = '#FFB6C1'; // LightPink body
        this.ctx.fillRect(x, y, w, h);

        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.2, h * 0.2); // Left eye white
        this.ctx.fillRect(x + w * 0.6, y + h * 0.2, w * 0.2, h * 0.2); // Right eye white
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(x + w * 0.25, y + h * 0.25, w * 0.1, h * 0.1); // Left pupil
        this.ctx.fillRect(x + w * 0.65, y + h * 0.25, w * 0.1, h * 0.1); // Right pupil

        this.ctx.beginPath();
        this.ctx.moveTo(x + w * 0.3, y + h * 0.7);
        this.ctx.lineTo(x + w * 0.7, y + h * 0.7);
        this.ctx.strokeStyle = 'black'; // Mouth color
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.lineWidth = 1; // Reset line width
    }

    drawUI() {
        this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        this.ctx.fillRect(10, 10, 200, 25);

        const healthPercentage = this.player.health / 100;
        const healthBarColor = healthPercentage > 0.66 ? '#00ff00' : healthPercentage > 0.33 ? '#ffff00' : '#ff0000';
        this.ctx.fillStyle = healthBarColor;
        this.ctx.fillRect(10, 10, this.player.health * 2, 25);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.strokeRect(10, 10, 200, 25);

        this.ctx.font = '24px "Press Start 2P"';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`分數: ${this.score}`, this.width - 20, 40);
        this.ctx.textAlign = 'left';
    }

    showNameInput() {
        this.nameInput.style.display = 'block';
        const canvasRect = this.canvas.getBoundingClientRect();
        // Center the input field horizontally relative to the canvas
        this.nameInput.style.left = `${canvasRect.left + (this.canvas.offsetWidth - this.nameInput.offsetWidth) / 2}px`;
        // Position it vertically; adjust the offset (e.g., 60) as needed
        this.nameInput.style.top = `${canvasRect.top + this.height / 2 + 30}px`; // Adjusted Y position
        this.nameInput.focus();
    }


    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.font = '48px "Press Start 2P"';
        this.ctx.fillStyle = '#ff0000';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('遊戲結束', this.width / 2, this.height / 2 - 120);

        this.ctx.font = '28px "Press Start 2P"';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`你的分數: ${this.score}`, this.width / 2, this.height / 2 - 60);

        this.ctx.font = '20px "Press Start 2P"';
        this.ctx.fillText('輸入名字按 Enter 儲存', this.width / 2, this.height / 2);
        // Note: The name input field is a DOM element, positioned by showNameInput()

        this.ctx.font = '20px "Press Start 2P"'; // Font for restart message
        this.ctx.fillText('按空白鍵重新開始', this.width / 2, this.height / 2 + 180);


        if (this.highScores.length > 0) {
            this.drawHighScores(this.height / 2 + 220); // Pass a starting Y position for high scores
        } else {
             this.ctx.font = '18px "Press Start 2P"';
             this.ctx.fillStyle = '#aaaaaa';
             this.ctx.fillText('正在讀取排行榜...', this.width / 2, this.height / 2 + 230);
        }
    }

    drawHighScores(startY = 50) {
        this.ctx.font = '20px "Press Start 2P"';
        this.ctx.fillStyle = '#ffd700';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏆 排行榜 🏆', this.width / 2, startY);

        this.ctx.font = '16px "Press Start 2P"';
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < Math.min(this.highScores.length, 10); i++) {
            const entry = this.highScores[i];
            const rankText = `${i + 1}. ${entry.name} - ${entry.score}`;
            this.ctx.fillText(rankText, this.width / 2, startY + 40 + i * 28);
        }
        this.ctx.textAlign = 'left';
    }

    // --- Supabase 整合功能 ---
    async submitScore() {
        const name = this.nameInput.value.trim();
        if (!name) {
            alert('請輸入你的名字！');
            this.nameInput.focus();
            return;
        }
        if (!window.supabase) {
            alert('Supabase 未初始化，無法儲存分數！');
            return;
        }

        this.nameInput.disabled = true;

        try {
            const { data, error } = await window.supabase
                .from('跳樓機')
                .insert([{ name: name, score: this.score }])
                .select();

            if (error) {
                console.error('上傳分數失敗:', error.message);
                alert('上傳分數失敗！\n' + error.message);
            } else {
                console.log('分數上傳成功:', data);
                alert('分數已儲存！');
                this.nameInput.style.display = 'none';
                this.nameInput.value = '';
                await this.fetchHighScores();
            }
        } catch (error) {
            console.error('上傳分數時發生錯誤:', error);
            alert('上傳分數時發生未知錯誤！');
        } finally {
            this.nameInput.disabled = false;
            // The problematic line `if (!alert.caller)` has been removed.
            // Input display is handled by successful submission or game restart logic.
            if (this.gameOver) {
                this.draw(); // Force a redraw to update the screen, especially if an error occurred.
            }
        }
    }

    async fetchHighScores() {
        if (!window.supabase) {
            console.warn('Supabase 未初始化，無法讀取排行榜！');
            this.highScores = [{name: "錯誤", score: "無法載入"}];
            if (this.gameOver) this.draw(); // Redraw to show this error state if game is over
            return;
        }
        try {
            const { data, error } = await window.supabase
                .from('跳樓機')
                .select('name, score')
                .order('score', { ascending: false })
                .limit(10);

            if (error) {
                console.error('讀取排行榜失敗:', error.message);
                this.highScores = [{name: "錯誤", score: error.message.substring(0,20)}];
            } else {
                this.highScores = data || [];
                console.log('排行榜資料:', this.highScores);
            }
        } catch (error) {
            console.error('讀取排行榜時發生錯誤:', error);
            this.highScores = [{name: "錯誤", score: "未知問題"}];
        }

        if (this.gameOver) {
            this.draw();
        }
    }
    // --- Supabase 整合功能結束 ---

    restart() {
        this.gameOver = false;
        this.score = 0;
        this.player.health = 100;
        this.player.x = this.width / 2;
        this.player.y = this.height / 2 - 100;
        this.player.velX = 0;
        this.player.velY = 0;
        this.player.canJump = false;
        this.player.invincibleTime = 0;
        this.damagedPlatforms.clear();

        this.initPlatforms();
        this.nameInput.style.display = 'none';
        this.nameInput.value = '';
        this.fetchHighScores();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.onload = () => {
    if (window.supabase) {
        new Game();
    } else {
        console.error("Supabase client not found. Game cannot start.");
        alert("遊戲無法啟動：無法連接到排行榜伺服器。請檢查您的網路連線並重新整理頁面。");
    }
};