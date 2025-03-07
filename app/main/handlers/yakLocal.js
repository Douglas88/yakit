const {ipcMain, Notification} = require("electron");
const childProcess = require("child_process");
const process = require("process");

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function notification(msg) {
    new Notification({title: msg}).show()
}

let yakProcess;
module.exports = (win, getClient) => {
    ipcMain.handle("kill-local-yak-grpc-server", async (e) => {
        console.info("start to kill / clean yak local grpc process")
        if (yakProcess) {
            try {
                yakProcess.kill()
            } catch (e) {
                console.info("KILL yakProcessError: " + `${e}`)
            }
        }
        yakProcess = null;
    })
    let randPort;
    ipcMain.handle("start-local-yak-grpc-server", async (e) => {
        if (yakProcess) {
            console.info("u have started local yak grpc...")
            return randPort;
        }

        if ((!`${process.env.PATH}`.includes("/usr/local/bin")) && (!`${process.env.PATH}`.includes("/usr/local/bin/"))) {
            process.env.PATH += ":/usr/local/bin"
        }

        randPort = 50000 + getRandomInt(10000);
        const cmd = `yak grpc --port ${randPort}`;

        let buffer = ""
        const child = childProcess.exec(cmd, (err, stdout, stderr) => {
            buffer = buffer + stdout + stderr
        })
        yakProcess = child;
        child.on("error", (err) => {
            notification(`Yak local gRPC start error: ${err}`)
            try {
                if (win) win.webContents.send("client-yak-local-grpc-error", `${err}`)
            } catch (e) {
            }
        })
        child.on("data", data => {
            console.info(data)
        })
        child.on("close", async (code, sig) => {
            const msg = `Yak local gRPC 本地进程已退出：CODE: ${code} SIG: ${sig} OUTPUT: ${buffer}`;
            notification(msg)
            randPort = null;
            try {
                if (win) win.webContents.send("client-yak-local-grpc-close", msg)
                if (win) win.webContents.send("client-start-local-grpc-failed")
            } catch (e) {

            }
        })
        return randPort;
    })
}