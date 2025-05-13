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
        // highScores 將從 Supabase 獲取，初始化為空陣列
        this.highScores = [];

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
        this.nameInput.style.fontSize = '20px';
        this.nameInput.style.padding = '5px';
        this.nameInput.style.display = 'none'; // 初始隱藏
        document.body.appendChild(this.nameInput);

        // 為名字輸入框綁定 Enter 事件
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.submitScore();
            }
        });

        this.initPlatforms();
        this.bindEvents(); // 綁定鍵盤事件
        this.bindMobileControls(); // 綁定手機控制按鈕事件
        this.gameLoop();

        // 在遊戲初始化時，獲取並顯示排行榜分數
        this.fetchHighScores();
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                    this.keys.right = true;
                    break;
                case ' ':
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
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
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

        btnLeft.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys.left = true;
        });
        btnLeft.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys.left = false;
        });

        btnRight.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys.right = true;
        });
        btnRight.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys.right = false;
        });

        btnJump.addEventListener('touchstart', (e) => {
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
        this.platforms.push({
            x: this.width / 2 - 50,
            y: this.height / 2 + this.player.height,
            width: 100,
            height: 20,
            type: 'normal'
        });

        for (let i = 1; i < 6; i++) {
            this.platforms.push({
                x: Math.random() * (this.width - 100),
                y: this.height - i * 100,
                width: 100,
                height: 20,
                type: this.platformTypes[Math.floor(Math.random() * this.platformTypes.length)]
            });
        }
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y + rect1.height > rect2.y &&
            rect1.y < rect2.y + rect2.height;
    }

    update() {
        if (this.gameOver) return;

        if (this.keys.left) {
            this.player.velX = Math.max(this.player.velX - this.player.acceleration, -this.player.maxSpeed);
        } else if (this.keys.right) {
            this.player.velX = Math.min(this.player.velX + this.player.acceleration, this.player.maxSpeed);
        } else {
            this.player.velX *= 0.9;
        }

        this.player.x += this.player.velX;
        this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));

        this.player.velY += this.gravity;
        this.player.y += this.player.velY;

        if (this.player.invincibleTime > 0) this.player.invincibleTime--;

        this.platforms.forEach(platform => {
            if (this.checkCollision(this.player, platform)) {
                if (platform.type === 'spike' && this.player.invincibleTime <= 0 && !this.damagedPlatforms.has(platform)) {
                    this.player.health = Math.max(0, this.player.health - 33);
                    this.player.invincibleTime = 60;
                    this.damagedPlatforms.add(platform);
                }
                if (this.player.velY > 0 && this.player.y + this.player.height <= platform.y + platform.height) {
                    this.player.velY = 0;
                    this.player.y = platform.y - this.player.height;
                    this.player.canJump = true;
                }
            }

            platform.y -= this.platformSpeed;
        });

        this.platforms = this.platforms.filter(p => p.y > -20);
        while (this.platforms.length < 6) {
            this.platforms.push({
                x: Math.random() * (this.width - 100),
                y: this.height,
                width: 100,
                height: 20,
                type: this.platformTypes[Math.floor(Math.random() * this.platformTypes.length)]
            });
        }

        if (this.player.y > this.height || this.player.health <= 0) {
            this.gameOver = true;
        }

        this.score++;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.platforms.forEach(platform => {
            this.ctx.fillStyle = platform.type === 'spike' ? '#ff0000' : '#00ff00';
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        });

        if (!(this.player.invincibleTime > 0 && this.player.invincibleTime % 6 > 3)) {
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

        this.ctx.fillStyle = '#FFB6A3';
        this.ctx.fillRect(x + 8, y + 4, 24, 20);

        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + 6, y + 2, 28, 8);
        this.ctx.fillRect(x + 30, y + 6, 4, 8);

        this.ctx.fillRect(x + 12, y + 12, 4, 4);
        this.ctx.fillRect(x + 24, y + 12, 4, 4);
        this.ctx.fillRect(x + 16, y + 18, 8, 2);
        this.ctx.fillRect(x + 16, y + 20, 8, 2);

        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + 8, y + 24, 24, 20);

        this.ctx.fillStyle = '#FFB6A3';
        this.ctx.fillRect(x + 4, y + 28, 4, 4);
        this.ctx.fillRect(x + 32, y + 28, 4, 4);

        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + 12, y + 44, 8, 6);
        this.ctx.fillRect(x + 20, y + 44, 8, 6);
    }

    drawUI() {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        this.ctx.fillRect(10, 10, 200, 20);

        const healthColor = this.player.health > 66 ? '#00ff00' : this.player.health > 33 ? '#ffff00' : '#ff0000';
        this.ctx.fillStyle = healthColor;
        this.ctx.fillRect(10, 10, this.player.health * 2, 20);

        this.ctx.font = '20px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`分數: ${this.score}`, this.width - 100, 30);
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.font = '48px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('遊戲結束', this.width / 2, this.height / 2 - 60);
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`你的分數: ${this.score}`, this.width / 2, this.height / 2 - 20);
        this.ctx.fillText('輸入名字並按 Enter 儲存', this.width / 2, this.height / 2 + 10);

        // 定位 DOM 元素的名字輸入框
        this.nameInput.style.display = 'block';
        this.nameInput.style.left = `${this.canvas.offsetLeft + this.width / 2 - this.nameInput.offsetWidth / 2}px`;
        this.nameInput.style.top = `${this.canvas.offsetTop + this.height / 2 + 40}px`;
        this.nameInput.focus(); // 自動聚焦輸入框

        // 當遊戲結束時，獲取並顯示最新的排行榜分數
        this.fetchHighScores();
    }

    drawHighScores() {
        this.ctx.font = '20px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('🏆 前十名玩家:', this.width / 2 - 100, this.height / 2 + 100);

        // 遍歷並顯示從 Supabase 獲取的最高分
        for (let i = 0; i < this.highScores.length; i++) {
            const entry = this.highScores[i];
            this.ctx.fillText(`${i + 1}. ${entry.name} - ${entry.score}`, this.width / 2 - 100, this.height / 2 + 130 + i * 24);
        }
    }

    // --- Supabase 整合功能 ---

    /**
     * 將玩家分數上傳到 Supabase 資料庫。
     */
    async submitScore() {
        const name = this.nameInput.value.trim();
        if (!name) {
            alert('請輸入你的名字！');
            return;
        }

        try {
            // !!! 請確認 'leaderboard' 是您在 Supabase 中建立的實際表格名稱 !!!
            const { data, error } = await window.supabase
                .from('leaderboard') // 您的 Supabase 表格名稱
                .insert([
                    { name: name, score: this.score },
                ]);

            if (error) {
                console.error('上傳分數失敗:', error.message);
                alert('上傳分數失敗！' + error.message);
            } else {
                console.log('分數上傳成功:', data);
                alert('分數已儲存！');
            }
        } catch (error) {
            console.error('上傳分數時發生錯誤:', error);
            alert('上傳分數時發生未知錯誤！');
        } finally {
            this.nameInput.style.display = 'none'; // 隱藏輸入框
            this.nameInput.value = ''; // 清空輸入框內容
            this.fetchHighScores(); // 提交後刷新排行榜
        }
    }

    /**
     * 從 Supabase 資料庫讀取排行榜分數。
     */
    async fetchHighScores() {
        try {
            // !!! 請確認 'leaderboard' 是您在 Supabase 中建立的實際表格名稱 !!!
            const { data, error } = await window.supabase
                .from('leaderboard') // 您的 Supabase 表格名稱
                .select('name, score')
                .order('score', { ascending: false }) // 按照分數降序排序
                .limit(10); // 獲取前 10 名

            if (error) {
                console.error('讀取排行榜失敗:', error.message);
            } else {
                this.highScores = data;
                console.log('排行榜資料:', this.highScores);
                this.drawHighScores(); // 使用獲取的資料重新繪製排行榜
            }
        } catch (error) {
            console.error('讀取排行榜時發生錯誤:', error);
        }
    }

    // --- Supabase 整合功能結束 ---

    restart() {
        this.gameOver = false;
        this.score = 0;
        this.player.health = 100;
        this.player.x = this.width / 2;
        this.player.y = this.height / 2;
        this.player.velX = 0;
        this.player.velY = 0;
        this.platforms = [];
        this.damagedPlatforms.clear();
        this.initPlatforms();
        this.nameInput.style.display = 'none'; // 重啟時隱藏名字輸入框
        this.nameInput.value = ''; // 清空輸入框內容
        this.fetchHighScores(); // 重啟後重新獲取並顯示排行榜
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.onload = () => {
    new Game();
};