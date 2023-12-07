/*
大猫bot
*/
let upDataCpu = Game.cpu.getUsed();
const e = 'energy',nir = ERR_NOT_IN_RANGE, npc = 'Invader';
module.exports.loop = function () {
    DealFlag();
}
//房间爬爬默认数量
const HomeCreepNum = {
    1: { carry: 6, build: 0, up: 6 },
    2: { carry: 6, build: 4, up: 6 },
    3: { carry: 4, build: 3, up: 4 },
    4: { carry: 4, build: 4, up: 4 },
    5: { carry: 2, build: 2, up: 2 },
    6: { carry: 1, build: 2, up: 1 },
    7: { carry: 1, build: 2, up: 1 },
    8: { carry: 1, build: 2, up: 1 }
};
//初始化bot(第一次用dmbot会把Memory全清了)
if(!Memory.player || !Memory.player.whiteList || Memory.player.whiteList[0] != 'BigCatCat'){
    let dm = Object.keys(Memory);
    for (let i = 0; i < dm.length; i++) {
        delete Memory[dm[i]]
    }
    let player = {};
    player.name = Game.spawns[Object.keys(Game.spawns)[0]].owner.username;
    player.whiteList = ['BigCatCat'];
    Memory.player = player;
    Memory.rooms = {};
    Memory.DMVERSION = 2;
}
//旗子
function DealFlag(){
    for(let flagName in Game.flags){
        let flag = Game.flags[flagName];
        if(flagName == 'addRoom'){
            dmRoom.add(flag.pos.roomName,'man')
            flag.remove();
            continue;
        }
        let splitFlagName = flagName.split('/');
        if(splitFlagName.length > 0){
            if(splitFlagName[0] == "addRoom"){
                if(splitFlagName[1] && splitFlagName[1] == 'dm'){
                    if(splitFlagName[2] && splitFlagName[2] == 'true'){
                        dmRoom.add(flag.pos.roomName,'dm',[flag.pos.x,flag.pos.y])
                    }else{
                        console.log(dmRoom.add(flag.pos.roomName,'dm'));
                    }
                    flag.remove();
                }
            }
        }
    }
    //显示布局
    let visualFlag = Game.flags['visual'];
    if(visualFlag){
        let room = visualFlag.room;
        let roomName = visualFlag.pos.roomName;
        if(!room || !Memory.rooms[roomName] || !Memory.rooms[roomName]['config']){
            DM_automatic_Layout.DM_visual(visualFlag);
        }else{
            if(Memory.rooms[roomName]['config']['layout']['type'] == 'dm' && Memory.rooms[roomName]['DM_layout']){
                new RoomVisual(roomName).import(Memory.rooms[roomName]['DM_layout']['visual']);
            }
        }
    }else{
        let c = Game.flags['c'],m = Game.flags['m'],s0 = Game.flags['s1'],s1 = Game.flags['s2'];
        if(c)c.remove();
        if(m) m.remove();
        if(s0)s0.remove();
        if(s1)s1.remove();
    }
}
//html
const HTML ={
    //超链接(到指定房间)
    Href(roomName){
        return `<a href="#!/room/${Game.shard.name}/${roomName}">${roomName}</a>`;
    }
}
//自动布局
const DM_automatic_Layout = {
    //无视野插旗子布局
    DM_visual(flag){
        let roomName = flag.pos.roomName;
        if(Memory.rooms[roomName] && Memory.rooms[roomName]['DM_layout'] && Memory.rooms[roomName]['DM_layout']['visual']){
            new RoomVisual(roomName).import(Memory.rooms[roomName]['DM_layout']['visual']);
        }else{
            let flag_controller = Game.flags['c'];
            if(!flag_controller){
                return console.log('缺少控制器位置');
            }else if(flag_controller.pos.roomName != roomName){
                flag_controller.remove();
                return console.log('缺少控制器位置');
            }
            let flag_sources = [];
            flag_sources[0] = Game.flags['s1'];
            if(!flag_sources[0]){
                return console.log('缺少能量位置')
            }else if(flag_sources[0].pos.roomName != roomName){
                flag_sources[0].remove();
                return console.log('缺少控能量位置');
            }
            if(Game.flags['s2']){
                if(Game.flags['s2'].pos.roomName != roomName){
                    Game.flags['s2'].remove();
                }else flag_sources[1] = Game.flags['s2'];
            }
            let flag_mineral = Game.flags['m'];
            if(!flag_mineral){
                return console.log('缺少矿物位置')
            }else if(flag_mineral.pos.roomName != roomName){
                flag_mineral.remove();
                return console.log('缺少矿物位置');
            }
            let flagArr = [];
            flagArr[0] = flag_controller;
            flagArr[1] = flag_sources;
            flagArr[2] = flag_mineral;
            this.DM_layout(roomName,flagArr);
        }
    },
    //显示布局
    DM_layout(roomName,flagArr,centerPos){
        if(Game.cpu.bucket < 400){
            console.log('bucket不足[' + Game.cpu.bucket + ']');
            return false;
        }
        if(!Memory.rooms[roomName]){
            Memory.rooms[roomName] = {};
        }
        if(!Memory.rooms[roomName]['DM_layout']){
            Memory.rooms[roomName]['DM_layout'] = {}
            Memory.rooms[roomName]['DM_layout']['visual'] = false;
            Memory.rooms[roomName]['DM_layout']['buildings'] = {};
        }
        if(!Memory.rooms[roomName]['DM_layout']['visual'])return this.Layout(roomName,flagArr,centerPos);
        else new RoomVisual(roomName).import(Memory.rooms[roomName]['DM_layout']['visual']);
    },
    //布局
    Layout(roomName,flagArr,centerPos){
        let beginCpu = Game.cpu.getUsed();
        //房间
        let room = Game.rooms[roomName];
        let controller;
        let sources = [];
        let mineralPos;
        if(room && roomName != 'sim'){
            controller = Game.rooms[roomName].controller;
            mineralPos = room.find(FIND_MINERALS)[0].pos
            sources = room.find(FIND_SOURCES)
        }else{
            controller = flagArr[0];
            for(let i = 0;i < flagArr[1].length;i++){
                sources[i] = flagArr[1][i];
            }
            mineralPos = flagArr[2].pos;
        }
        //地形
        const terrain = new Room.Terrain(roomName);
        //对比costs
        let costs = new PathFinder.CostMatrix;
        //建筑cost
        let buildingCosts = new PathFinder.CostMatrix;
        //建筑缓存,初始化
        let buildingsObject = {};
        buildingsObject['spawn'] = {};
        buildingsObject['tower'] = {};
        buildingsObject['factory'] = {};
        buildingsObject['nuker'] = {};
        buildingsObject['container'] = {};
        buildingsObject['lab'] = {};
        buildingsObject['terminal'] = {};
        buildingsObject['extractor'] = {};
        buildingsObject['powerSpawn'] = {};
        buildingsObject['observer'] = {};
        buildingsObject['storage'] = {};
        buildingsObject['rampart'] = {};
        buildingsObject['constructedWall'] = {};
        buildingsObject['road'] = {};
        buildingsObject['link'] = {};
        buildingsObject['extension'] = {};
        //地形导入建筑缓存
        for(let x = 0;x < 50;x++){
            for(let y = 0;y < 50;y++){
                let type = terrain.get(x,y);
                buildingCosts.set(x,y,type == 0 ? 2 : type == 1 ? 255 : 10);
            }
        }
        let median = [];
        if(centerPos){
            if(!Array.isArray(centerPos) || centerPos.length > 2){
                return roomName + '布局中心参数错误'
            }
            median[0] = centerPos[0];
            median[1] = centerPos[1];
            if((median[0] < 5 || median[0] > 44) || (median[1] < 5 || median[1] > 44)){
                let visual = new RoomVisual(roomName);
                visual.text('中心至少跟边界',median[0],median[1]-0.3,{
                    font : 0.5
                })
                visual.text('距离大于5',median[0],median[1]+0.3,{
                    font : 0.5
                })
                visual.rect(4.5,4.5,40,40,{ stroke: 'yellow', fill: 'green', opacity: 0.2 });
                Memory.rooms[roomName]['DM_layout']['visual'] = visual.export()
                return false;
            }
            let unBuildPos = [];
            for(let x = median[0] - 2;x <= median[0] + 2;x++){
                for(let y = median[1] - 2;y <= median[1] + 2;y++){
                    if(terrain.get(x,y) == 1){
                        unBuildPos.push([x,y])
                    }
                }
            }
            if(unBuildPos.length > 0){
                let visual = new RoomVisual(roomName);
                visual.text('中心至少5*5无障碍物',median[0],median[1],{
                    font : 0.5
                })
                visual.rect(median[0] - 2.5,median[1] - 2.5,5,5,{ stroke: 'yellow', fill: 'green', opacity: 0.2 });
                for(let pos of unBuildPos){
                    visual.rect(pos[0] - 0.5,pos[1] - 0.5,1,1,{ stroke: 'red', fill: 'red', opacity: 0.2 })
                }
                Memory.rooms[roomName]['DM_layout']['visual'] = visual.export()
                return false;
            }
        }else{
            //找中心区域（cost=250为第一层可作为中心区的位置，3格[5*5]内没有地形墙）
            let center_1 = [];
            for(let terrain_x = 2;terrain_x < 48;terrain_x++){
                for(let terrain_y = 2;terrain_y < 48;terrain_y++){
                    let node_value = 0;
                    for(let x = terrain_x - 2;x <= terrain_x + 2;x++){
                        for(let y = terrain_y - 2;y <= terrain_y + 2;y++){
                            let type = terrain.get(x,y);
                            if(type != 1){
                                node_value += 10;
                            }
                        }
                    }
                    if(node_value == 250){
                        if(terrain_x >= 42 || terrain_x <= 7 || terrain_y >= 42 || terrain_y <= 7){
                            continue;
                        }
                        costs.set(terrain_x,terrain_y,250);
                        center_1.push([terrain_x,terrain_y])
                    }
                }
            }
            let center1 = [0,0,50];
            for(let center of center_1){
                let x = center[0];
                let y = center[1];
                if(this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y) <= 4)continue;
                let wall = [1,1,1,1]
                for(let i = -2;i <= 2;i++){
                    if(wall[0] == 1 && terrain.get(x + i,y - 3) == 1){
                        wall[0] = 0;
                    }
                    if(wall[1] == 1 && terrain.get(x + i,y + 3) == 1){
                        wall[1] = 0;
                    }
                    if(wall[2] == 1 && terrain.get(x - 3,y + i) == 1){
                        wall[2] = 0;
                    }
                    if(wall[3] == 1 && terrain.get(x + 3,y + i) == 1){
                        wall[3] = 0;
                    }
                }
                let sum = 0;
                for(let value of wall){
                    sum += value;
                }
                if(sum < 3)continue;
                let f = 0;
                for(let cx = x - 1;cx <= x + 1;cx++){
                    for(let cy = y - 1;cy <= y + 1;cy++){
                        let cost = costs.get(cx,cy);
                        if(cost == 250){
                            f++;
                        }
                        if(f >= 4)break;
                    }
                    if(f >= 4)break;
                }
                if(f >= 4){
                    let length = this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y);
                    if(length < center1[2]){
                        center1 = [x,y,length];
                    }
                }
            }
            if(center1[2] == 50){
                this.Visual(costs,roomName);
                return console.log('中心布局失败1')
            }
            //过滤中心区域（cost=251为第二层可作为中心的位置，1格[3*3]内cost=250）
            let center_2 = [];
            for(let center of center_1){
                let terrain_x = center[0];
                let terrain_y = center[1];
                if(controller.pos.getRangeTo(terrain_x,terrain_y) <= 5){
                    continue;
                }
                let f = true;
                for(let x = terrain_x - 1;x <= terrain_x + 1;x++){
                    for(let y = terrain_y - 1;y <= terrain_y + 1;y++){
                        if(costs.get(x,y) == 0){
                            f = false;
                            break;
                        }
                    }
                    if(!f)break;
                }
                if(!f)continue;
                if(PathFinder.search(
                    new RoomPosition(terrain_x,terrain_y,roomName),
                    {pos : controller.pos,range : 1}
                ).path.length >= 20)continue;
                costs.set(terrain_x,terrain_y,251);
                center_2.push([terrain_x,terrain_y])
            }
            let length_min_0 = [0,0,50];
            {
                let lengths = [];
                for(let center of center_2){
                    let length = controller.pos.getRangeTo(center[0],center[1]);
                    if(length >= 15 || length < 5 || center[0] <= 7 || center[1] <= 7 || center[0] >= 42 || center[1] >= 42){
                        costs.set(center[0],center[1],250);
                        continue;
                    }
                    lengths.push([center[0],center[1],length]);
                }
                if(lengths.length > 0){
                    let lengths_ = [];
                    for(let length of lengths){
                        let x = length[0];
                        let y = length[1];
                        if((costs.get(x + 1,y) == 250 && costs.get(x - 1,y) == 250) || (costs.get(x,y + 1) == 250 && costs.get(x,y - 1) == 250)){
                            costs.set(x,y,250);
                            continue;
                        }
                        lengths_.push(length);
                    }
                    for(let length of lengths_){
                        let l = this.DM_XY_Distence(length[0],length[1],controller.pos.x,controller.pos.y,true);
                        if(l < length_min_0[2]){
                            length_min_0 = [length[0],length[1],l]
                        }
                    }
                }
            }
            //过滤中心区域（cost=252为第三层，一格内[3*3]cost=251）
            for(let center of center_2){
                let terrain_x = center[0];
                let terrain_y = center[1];
                if(controller.pos.getRangeTo(terrain_x,terrain_y) <= 5){
                    continue;
                }
                let f = true;
                for(let x = terrain_x - 1;x <= terrain_x + 1;x++){
                    for(let y = terrain_y - 1;y <= terrain_y + 1;y++){
                        if(costs.get(x,y) == 250){
                            f = false;
                            break;
                        }
                    }
                    if(!f)break;
                }
                if(!f)continue;
                if(PathFinder.search(
                    new RoomPosition(terrain_x,terrain_y,roomName),
                    {pos : controller.pos,range : 1},
                    {
                        plainCost : 2,
                        swampCost : 2
                    }
                ).path.length >= 15)continue;
                costs.set(terrain_x,terrain_y,252);
            }
            let length_min_1 = [0,0,50];
            {
                let lengths = [];
                for(let terrain_x = 2;terrain_x < 48;terrain_x++){
                    for(let terrain_y = 2;terrain_y < 48;terrain_y++){
                        if(costs.get(terrain_x,terrain_y) == 252){
                            let length = controller.pos.getRangeTo(terrain_x,terrain_y)
                            if(length >= 15 || length < 5 || terrain_x <= 7 || terrain_y <= 7 || terrain_x >= 42 || terrain_y >= 42){
                                costs.set(terrain_x,terrain_y,251);
                                continue;
                            }
                            lengths.push([terrain_x,terrain_y,length]);
                        }
                    }
                }
                if(lengths.length > 0){
                    let lengths_ = [];
                    for(let length of lengths){
                        let x = length[0];
                        let y = length[1];
                        if((costs.get(x + 1,y) == 251 && costs.get(x - 1,y) == 251) || (costs.get(x,y + 1) == 251 && costs.get(x,y - 1) == 251)){
                            costs.set(x,y,251);
                            continue;
                        }
                        lengths_.push(length);
                    }
                    for(let length of lengths_){
                        let l = this.DM_XY_Distence(length[0],length[1],controller.pos.x,controller.pos.y,true);
                        if(l < length_min_1[2]){
                            length_min_1 = [length[0],length[1],l]
                        }
                    }
                }
            }
            //选择层级
            this.Visual(costs,roomName);
        
            //调整中心位置
            median = [length_min_1[0],length_min_1[1]];
            let spare = false;
            if(length_min_0[2] == 50 && length_min_1[2] == 50){
                if(center1[2] == 50){
                    this.Visual(costs,roomName);
                    return console.log('中心布局失败2');
                }else{
                    spare = true;
                    median = [center1[0],center1[1]];
                }
            }
            if(!spare){
                let changeMedian = 0;
                if(length_min_1[2] < 50){
                    let centerTransform = [[median[0] + 6,median[1]],[median[0] - 6,median[1]],[median[0],median[1] + 6],[median[0],median[1] - 6]]
                    let center_length = [];
                    for(let center of centerTransform){
                        let x = center[0];
                        let y = center[1];
                        center_length.push(terrain.get(x,y) == 1 ? this.DM_XY_Distence((median[0] + x) / 2,(median[1] + y) / 2,controller.pos.x,controller.pos.y) : 50);
                    }
                    let min = 50;
                    for(let length of center_length){
                        if(length < min){
                            min = length;
                        }
                    }
                    if(min != 50){
                        let center = centerTransform[center_length.indexOf(min)];
                        median[0] = ((median[0] + center[0]) / 2) > median[0] ? median[0] += changeMedian : median[0] -= changeMedian;
                        median[1] = ((median[1] + center[1]) / 2) > median[1] ? median[1] += changeMedian : median[1] -= changeMedian;
                    }
                }else{
                    median = [length_min_0[0],length_min_0[1]];
                    let centerTransform = [[median[0] + 6,median[1]],[median[0] - 6,median[1]],[median[0],median[1] + 6],[median[0],median[1] - 6]]
                    let center_length = [];
                    for(let center of centerTransform){
                        let x = center[0];
                        let y = center[1];
                        center_length.push(terrain.get(x,y) == 1 ? this.DM_XY_Distence((median[0] + x) / 2,(median[1] + y) / 2,controller.pos.x,controller.pos.y) : 50);
                    }
                    let min = 50;
                    for(let length of center_length){
                        if(length < min){
                            min = length;
                        }
                    }
                    if(min != 50){
                        let center = centerTransform[center_length.indexOf(min)];
                        median[0] = ((median[0] + center[0]) / 2) > median[0] ? median[0] += changeMedian : median[0] -= changeMedian;
                        median[1] = ((median[1] + center[1]) / 2) > median[1] ? median[1] += changeMedian : median[1] -= changeMedian;
                    }
                }
            }
        }
        //中心布局
        let center_energy = [];
        {
            let x = center_energy[0] = median[0];
            let y = center_energy[1] = median[1];
            for(let cx = x - 2;cx <= x + 2;cx++){
                for(let cy = y - 2;cy <= y + 2;cy++){
                    buildingCosts.set(cx,cy,255);
                }
            }
            buildingsObject['extension'][(x - 2) + '/' + (y - 1)] = 1;
            buildingsObject['extension'][(x - 1) + '/' + y] = 1;
            buildingsObject['extension'][x + '/' + (y - 1)] = 1;
            buildingsObject['extension'][(x + 1) + '/' + y] = 1;
            buildingsObject['extension'][(x + 2) + '/' + (y - 1)] = 1;
            buildingsObject['spawn'][x + '/' + (y - 2)] = 1;
            buildingsObject['rampart'][x + '/' + (y - 2)] = 6;

            buildingsObject['extension'][(x - 2) + '/' + (y - 2)] = 2;
            buildingsObject['extension'][(x - 1) + '/' + (y - 2)] = 2;
            buildingsObject['extension'][(x + 1) + '/' + (y - 2)] = 2;
            buildingsObject['extension'][(x + 2) + '/' + (y - 2)] = 2;
            buildingsObject['extension'][x + '/' + (y + 1)] = 2;

            buildingsObject['extension'][(x - 2) + '/' + (y + 1)] = 3;
            buildingsObject['extension'][(x - 2) + '/' + (y + 2)] = 3;
            buildingsObject['extension'][(x - 1) + '/' + (y + 2)] = 3;
            buildingsObject['extension'][(x + 1) + '/' + (y + 2)] = 3;
            buildingsObject['extension'][(x + 2) + '/' + (y + 2)] = 3;
            buildingsObject['extension'][(x + 2) + '/' + (y + 1)] = 3;

            let road_left = x - 3;
            for(let terrain_y = y - 2;terrain_y <= y + 2;terrain_y++){
                if(terrain.get(road_left,terrain_y) != 1){
                    buildingsObject['road'][road_left + '/' + terrain_y] = 3;
                }
            }

            let road_right = x + 3;
            for(let terrain_y = y - 2;terrain_y <= y + 2;terrain_y++){
                if(terrain.get(road_right,terrain_y) != 1){
                    buildingsObject['road'][road_right + '/' + terrain_y] = 3;
                }
            }
            
            let road_up = y - 3;
            for(let terrain_x = x - 2;terrain_x <= x + 2;terrain_x++){
                if(terrain.get(terrain_x,road_up) != 1){
                    buildingsObject['road'][terrain_x + '/' + road_up] = 3;
                }
            }
            
            let road_down = y + 3;
            for(let terrain_x = x - 2;terrain_x <= x + 2;terrain_x++){
                if(terrain.get(terrain_x,road_down) != 1){
                    buildingsObject['road'][terrain_x + '/' + road_down] = 3;
                }
            }

            buildingsObject['container'][(x - 2) + '/' + y] = 3;
            buildingsObject['container'][(x + 2) + '/' + y] = 3;

            buildingsObject['link'][x + '/' + y] = 5;

            buildingsObject['spawn'][x + '/' + (y + 2)] = 7;
            buildingsObject['rampart'][x + '/' + (y + 2)] = 7;
            
            let up_container_pos = [];
            for(let x = controller.pos.x - 3;x <= controller.pos.x + 3;x++){
                for(let y = controller.pos.y - 3;y <= controller.pos.y + 3;y++){
                    if(Math.abs(x - controller.pos.x) <= 1 && Math.abs(y - controller.pos.y) <= 1)continue;
                    let count = 0;
                    for(let cx = x - 1;cx <= x + 1;cx++){
                        for(let cy = y - 1;cy <= y + 1;cy++){
                            if(buildingCosts.get(cx,cy) != 255){
                                count++;
                            }
                        }  
                    }
                    up_container_pos.push([x,y,count]);
                }
            }
            up_container_pos.sort(function(a,b){
                return b[2] - a[2];
            })
            buildingsObject['container'][up_container_pos[0][0] + '/' + up_container_pos[0][1]] = 2;

            buildingsObject['extractor'][mineralPos.x + '/' + mineralPos.y] = 6;
                
            buildingCosts = this.DM_cost255(buildingCosts,buildingsObject);
        }   
        
        //战略集群
        let strategicCluster = [];
        {
            let strategicCluster_pos = [];
            let distence = 8;
            for(let x = center_energy[0] - distence;x <= center_energy[0] + distence;x++){
                for(let y = center_energy[1] - distence;y <= center_energy[1] + distence;y++){
                    if(x < 3 || y < 3 || x > 46 || y > 46){
                        continue;
                    }
                    let f = true;
                    if(x <= 6){
                        for(let sy = y - 5;sy <= y + 5;sy++){
                            if(sy < 0 || sy > 49)continue;
                            if(terrain.get(0,sy) != 1){
                                f = false;
                                break;                                
                            }
                        }
                    }
                    if(!f)continue;
                    if(y <= 6){
                        for(let sx = x - 5;sx <= x + 5;sx++){
                            if(sx < 0 || sx > 49)continue;
                            if(terrain.get(sx,0) != 1){
                                f = false;
                                break;                                
                            }
                        }
                    }
                    if(!f)continue;
                    if(x >= 43){
                        for(let sy = y - 5;sy <= y + 5;sy++){
                            if(sy < 0 || sy > 49)continue;
                            if(terrain.get(49,sy) != 1){
                                f = false;
                                break;                                
                            }
                        }
                    }
                    if(!f)continue;
                    if(y >= 43){
                        for(let sx = x - 5;sx <= x + 5;sx++){
                            if(sx < 0 || sx > 49)continue;
                            if(terrain.get(sx,49) != 1){
                                f = false;
                                break;                                
                            }
                        }
                    }
                    if(!f)continue;
                    if(buildingCosts.get(x,y) == 255 
                    || this.DM_XY_Distence(x,y,center_energy[0],center_energy[1]) <= 5
                    || this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y) <= 3){
                        continue;
                    }
                    let sw = 0;
                    for(let sx = x - 2; sx <= x + 2;sx++){
                        if(terrain.get(sx,y - 2) == 1){
                            sw++;
                        }
                        if(terrain.get(sx,y + 2) == 1){
                            sw++;
                        }
                    }
                    for(let sy = y - 2; sy <= y + 2;sy++){
                        if(terrain.get(x - 2,sy) == 1){
                            sw++;
                        }
                        if(terrain.get(x + 2,sy) == 1){
                            sw++;
                        }
                    }
                    if(sw > 4){
                        continue;
                    }
                    for(let costs_x = x - 1;costs_x <= x + 1;costs_x++){
                        for(let costs_y = y - 1;costs_y <= y + 1;costs_y++){
                            if(buildingCosts.get(costs_x,costs_y) == 255){
                                f = false;
                                break;
                            }
                        }
                        if(!f)break;
                    }
                    if(!f)continue;
                    for(let source of sources){
                        if(source.pos.getRangeTo(x,y) <= 4){
                            f = false;
                            break;
                        }
                    }
                    if(!f)continue;
                    let f_wall = [1,1,1,1];
                    for(let i = -1;i < 2;i++){
                        if(f_wall[0] == 1 && buildingCosts.get(x + i,y - 2) == 255){
                            f_wall[0] = 0;
                        }
                        if(f_wall[1] == 1 && buildingCosts.get(x + i,y + 2) == 255){
                            f_wall[1] = 0;
                        }
                        if(f_wall[2] == 1 && buildingCosts.get(x - 2,y + i) == 255){
                            f_wall[2] = 0;
                        }
                        if(f_wall[3] == 1 && buildingCosts.get(x + 2,y + i) == 255){
                            f_wall[3] = 0;
                        }
                    }
                    let wall = 0;
                    for(let value of f_wall){
                        wall += value;
                    }
                    if(wall < 3)continue;
                    strategicCluster_pos.push([x,y,this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y,true)]);
                }
            }
            if(strategicCluster_pos.length == 0){
                return console.log('中央集群布局失败');
            }
            strategicCluster_pos.sort(function(a,b){
                return a[2] - b[2];
            })
            let x = strategicCluster[0] = strategicCluster_pos[0][0];
            let y = strategicCluster[1] = strategicCluster_pos[0][1];
            let path = PathFinder.search(
                new RoomPosition(x,y,roomName),
                {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                {
                    plainCost : 2,
                    swampCost : 10,
                    roomCallback:function(){
                        return buildingCosts;
                    }
                }
            ).path;
            if(path.length > 10){
                let path_min = [0,0,50]
                for(let i = 1;i < strategicCluster_pos.length;i++){
                    let x = strategicCluster_pos[i][0];
                    let y = strategicCluster_pos[i][1];
                    let path = PathFinder.search(
                        new RoomPosition(x,y,roomName),
                        {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                        {
                            plainCost : 2,
                            swampCost : 10,
                            roomCallback:function(){
                                return buildingCosts;
                            }
                        }
                    ).path;
                    if(path.length < path_min[2]){
                        path_min = [x,y,path.length];
                    }
                }
                if(path_min[2] < 50){
                    x = strategicCluster[0] = path_min[0];
                    y = strategicCluster[1] = path_min[1];
                }
            }
            buildingCosts.set(x,y,255);
            for(let i = 0;i < 3;i++){
                if(terrain.get(x - 1 + i,y - 2) != 1){
                    buildingsObject['road'][(x - 1 + i) + '/' + (y - 2)] = 4;
                }
                if(terrain.get(x - 1 + i,y + 2) != 1){
                    buildingsObject['road'][(x - 1 + i) + '/' + (y + 2)] = 4;
                }
                if(terrain.get(x - 2,y - 1 + i) != 1){
                    buildingsObject['road'][(x - 2) + '/' + (y - 1 + i)] = 4;
                }
                if(terrain.get(x + 2,y - 1 + i) != 1){
                    buildingsObject['road'][(x + 2) + '/' + (y - 1 + i)] = 4;
                }
            }
            
            let tower_y = y > 25 ? y - 1 : y + 1;
            let storage_x = x > 25 ? x - 1 : x + 1;
            let terminal_x = x > 25 ? x + 1 : x - 1;
            let factory_y = y > 25 ? y + 1 : y - 1;
            buildingsObject['tower'][x + '/' + tower_y] = 3;
            buildingsObject['rampart'][x + '/' + tower_y] = 6;

            buildingsObject['storage'][storage_x + '/' + tower_y] = 4;
            buildingsObject['rampart'][storage_x + '/' + tower_y] = 6;

            buildingsObject['link'][storage_x + '/' + y] = 5;

            buildingsObject['terminal'][terminal_x + '/' + tower_y] = 6;
            buildingsObject['rampart'][terminal_x + '/' + tower_y] = 6;

            buildingsObject['factory'][x + '/' + factory_y] = 7;

            buildingsObject['nuker'][terminal_x + '/' + factory_y] = 8;
            buildingsObject['rampart'][terminal_x + '/' + factory_y] = 8;

            buildingsObject['powerSpawn'][storage_x + '/' + factory_y] = 8;
            buildingsObject['rampart'][storage_x + '/' + factory_y] = 8;

            buildingsObject['spawn'][terminal_x + '/' + y] = 8;
            buildingsObject['rampart'][terminal_x + '/' + y] = 8;
            
            buildingCosts = this.DM_cost255(buildingCosts,buildingsObject);

        }
        
        //lab
        let labPos = [];
        {
            let distence = 15;
            let lab_pos = [];
            for(let x = center_energy[0] - distence;x <= center_energy[0] + distence;x++){
                for(let y = center_energy[1] - distence;y <= center_energy[1] + distence;y++){
                    if(x < 5 || y < 5 || x >= 45 || y >= 45){
                        continue;
                    }
                    if(buildingCosts.get(x,y) == 255 
                    || this.DM_XY_Distence(x,y,center_energy[0],center_energy[1]) <= 5
                    || this.DM_XY_Distence(x,y,strategicCluster[0],strategicCluster[1]) < 4
                    || this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y) <= 2){
                        continue;
                    }
                    let f = true;
                    for(let costs_x = x - 2;costs_x <= x + 2;costs_x++){
                        for(let costs_y = y - 2;costs_y <= y + 2;costs_y++){
                            if(buildingCosts.get(costs_x,costs_y) == 255){
                                f = false;
                                break;
                            }
                        }
                        if(!f)break;
                    }
                    if(!f)continue;
                    lab_pos.push([x,y,this.DM_XY_Distence(x,y,Math.floor((strategicCluster[0] + center_energy[0]) / 2),Math.floor((strategicCluster[1] + center_energy[1]) / 2),true)])
                    // visual.rect(x - 0.5,y - 0.5,1,1,{
                    //     fill : 'blue'
                    // })
                }
            }
            if(lab_pos.length == 0){
                return console.log('lab布局失败');
            }
            lab_pos.sort(function(a,b){
                return a[2] - b[2];
            })
            let labPos_ = [];
            let x = labPos[0] = lab_pos[0][0];
            let y = labPos[1] = lab_pos[0][1];
            buildingsObject['road'][x + '/' + y] = 6;
            if(x < strategicCluster[0]){
                if(y < strategicCluster[1]){
                    labPos_[0] = x + '/' + (y - 1);
                    labPos_[1] = (x - 1) + '/' + y;
                    labPos_[2] = x + '/' + (y + 1);
                    buildingsObject['road'][(x - 1) + '/' + (y - 1)] = 6;
                    buildingsObject['road'][(x - 2) + '/' + (y - 2)] = 6;
                    buildingsObject['road'][(x + 1) + '/' + (y + 1)] = 6;
                    buildingCosts.set((x - 1), (y - 1),1);
                    buildingCosts.set((x - 2), (y - 2),1);
                    buildingCosts.set((x + 1), (y + 1),1);

                    labPos_[3] = (x - 1) + '/' + (y + 1);
                    labPos_[4] = (x + 1) + '/' + (y - 1);
                    labPos_[5] = (x + 1) + '/' + y;
                    
                    labPos_[6] = (x - 2) + '/' + y;
                    labPos_[7] = (x - 2) + '/' + (y - 1);
                    labPos_[8] = (x - 1) + '/' + (y - 2);
                    labPos_[9] = x + '/' + (y - 2);
                }else{
                    labPos_[0] = x + '/' + (y + 1);
                    labPos_[1] = (x - 1) + '/' + y;
                    labPos_[2] = (x + 1) + '/' + y;
                    buildingsObject['road'][(x - 1) + '/' + (y + 1)] = 6;
                    buildingsObject['road'][(x - 2) + '/' + (y + 2)] = 6;
                    buildingsObject['road'][(x + 1) + '/' + (y - 1)] = 6;
                    buildingCosts.set((x + 1), (y - 1),1);
                    buildingCosts.set((x - 1), (y + 1),1);
                    buildingCosts.set((x - 2), (y + 2),1);

                    labPos_[3] = (x - 1) + '/' + (y - 1);
                    labPos_[4] = (x + 1) + '/' + (y + 1);
                    labPos_[5] = x + '/' + (y - 1);

                    labPos_[6] = (x - 2) + '/' + y;
                    labPos_[7] = (x - 2) + '/' + (y + 1);
                    labPos_[8] = (x - 1) + '/' + (y + 2);
                    labPos_[9] = x + '/' + (y + 2);
                }
            }else{
                if(y < strategicCluster[1]){
                    labPos_[0] = x + '/' + (y - 1);
                    labPos_[1] = (x + 1) + '/' + y;
                    labPos_[2] = x + '/' + (y + 1);
                    buildingsObject['road'][(x + 1) + '/' + (y - 1)] = 6;
                    buildingsObject['road'][(x + 2) + '/' + (y - 2)] = 6;
                    buildingsObject['road'][(x - 1) + '/' + (y + 1)] = 6;
                    buildingCosts.set((x - 1), (y + 1),1);
                    buildingCosts.set((x + 1), (y - 1),1);
                    buildingCosts.set((x + 2), (y - 2),1);

                    labPos_[3] = (x - 1) + '/' + (y - 1);
                    labPos_[4] = (x + 1) + '/' + (y + 1);
                    labPos_[5] = (x - 1) + '/' + y;
                    
                    labPos_[6] = (x + 2) + '/' + y;
                    labPos_[7] = (x + 2) + '/' + (y - 1);
                    labPos_[8] = (x + 1) + '/' + (y - 2);
                    labPos_[9] = x + '/' + (y - 2);
                }else{
                    labPos_[0] = x + '/' + (y + 1);
                    labPos_[1] = (x + 1) + '/' + y;
                    labPos_[2] = x + '/' + (y - 1);
                    buildingsObject['road'][(x + 1) + '/' + (y + 1)] = 6;
                    buildingsObject['road'][(x + 2) + '/' + (y + 2)] = 6;
                    buildingsObject['road'][(x - 1) + '/' + (y - 1)] = 6;
                    buildingCosts.set((x - 1), (y - 1),1);
                    buildingCosts.set((x + 1), (y + 1),1);
                    buildingCosts.set((x + 2), (y + 2),1);

                    labPos_[3] = (x - 1) + '/' + (y + 1);
                    labPos_[4] = (x + 1) + '/' + (y - 1);
                    labPos_[5] = (x - 1) + '/' + y;

                    labPos_[6] = (x + 2) + '/' + y;
                    labPos_[7] = (x + 2) + '/' + (y + 1);
                    labPos_[8] = (x + 1) + '/' + (y + 2);
                    labPos_[9] = x + '/' + (y + 2);
                }
            }
            for(let i = 0;i < 10;i++){
                if(i < 2){
                    buildingsObject['rampart'][labPos_[i]] = 8;
                }
                buildingsObject['lab'][labPos_[i]] = i < 3 ? 6 : i < 6 ? 7 : 8;
            }
            buildingCosts = this.DM_cost255(buildingCosts,buildingsObject);
            
        }
        let extension_3 = 4
        let extension_4 = 10;
        let containerPos = [];
        //能量附近extension
        {
            let extensions_pos = [];
            let linkPos = [];
            sources.forEach(source =>{
                //确定container位置
                let container_pos = [0,0,0];
                for(let x = source.pos.x - 1;x <= source.pos.x + 1;x++){
                    for(let y = source.pos.y - 1;y <= source.pos.y + 1;y++){
                        if(terrain.get(x,y) != 1){
                            let count = 0;
                            for(let cx = x - 1;cx <= x + 1;cx++){
                                for(let cy = y - 1;cy <= y + 1;cy++){
                                    if(cx == x && cy == y)continue;
                                    if(cx <= 1 || cx >= 48 || cy <= 1 || cy >= 48)continue;
                                    if(terrain.get(cx,cy) != 1 && buildingCosts.get(x,y) != 255){
                                        count++;
                                    }
                                }
                            }
                            if(count > container_pos[2]){
                                container_pos = [x,y,count];
                            }
                        }
                    }
                }
                buildingsObject['container'][container_pos[0] + '/' + container_pos[1]] = 3;
                containerPos.push(container_pos);
            })
            if(containerPos.length == 1){
                let needLink = PathFinder.search(
                    sources[0].pos,
                    new RoomPosition(strategicCluster[0],strategicCluster[1],roomName),
                    {
                        plainCost : 2,
                        swampCost : 10,
                        roomCallback:function(){
                            return buildingCosts;
                        }
                    }
                ).path.length > 10
                let road_0 = this.DM_path_sourceContainer_strategicCluster(new RoomPosition(containerPos[0][0],containerPos[0][1],roomName),new RoomPosition(strategicCluster[0],strategicCluster[1],roomName),buildingCosts);
                for(let x = containerPos[0][0] - 1;x <= containerPos[0][0] + 1;x++){
                    for(let y = containerPos[0][1] - 1;y <= containerPos[0][1] + 1;y++){
                        if(x == containerPos[0][0] && y == containerPos[0][1])continue;
                        if(x == road_0[0].x && y == road_0[0].y){
                            continue;
                        }
                        if(x <= 1 || y <= 1 || x >= 48 || y >= 48){
                            continue;
                        }
                        if(terrain.get(x,y) != 1 && buildingCosts.get(x,y) != 255 && buildingCosts.get(x,y) != 1){
                            if(needLink && !linkPos[0]){
                                linkPos[0] = [x,y]
                                buildingsObject['link'][x + '/' + y] = 6;
                            }else{
                                extensions_pos.push(x,y);
                                if(extension_3 > 0){
                                    buildingsObject['extension'][x + '/' + y] = 3;
                                    extension_3--;
                                }else{
                                    buildingsObject['extension'][x + '/' + y] = 4;
                                    extension_4--;
                                }
                            }
                            buildingCosts.set(x,y,255);                            
                        }
                    }   
                }
            }else{
                let container_length = this.DM_XY_Distence(containerPos[0][0],containerPos[0][1],containerPos[1][0],containerPos[1][1]);
                if(container_length <= 4){
                    let path = PathFinder.search(
                        new RoomPosition(containerPos[0][0],containerPos[0][1],roomName),
                        new RoomPosition(containerPos[1][0],containerPos[1][1],roomName),
                        {
                            plainCost: 2,
                            swampCost: 2,
                        }
                    ).path;
                    if(container_length > 2){
                        for(let pos of path){
                            buildingCosts.set(pos.x,pos.y,255);
                        }
                        path.push(new RoomPosition(containerPos[0][0],containerPos[0][1],roomName));
                        let path_mid = path[Math.floor(path.length / 2) - 1];
                        let link_pos = [];
                        for(let x = path_mid.x - 1;x <= path_mid.x + 1;x++){
                            for(let y = path_mid.y - 1;y <= path_mid.y + 1;y++){
                                if(buildingCosts.get(x,y) == 255 
                                || (x == path_mid.x && y == path_mid.y)
                                || (x == containerPos[0][0] && y == containerPos[0][1])
                                || (x == containerPos[1][0] && y == containerPos[1][1])){
                                    continue;
                                }
                                link_pos.push([x,y,this.DM_XY_Distence(x,y,strategicCluster[0],strategicCluster[1])]);
                            }
                        }
                        link_pos.sort(function(a,b){
                            return a[2] - b[2];
                        })
                        buildingsObject['link'][link_pos[0][0] + '/' + link_pos[0][1]] = 6;
                        linkPos = [link_pos[0][0],link_pos[0][1]];
                    }else{
                        let path_mid = path[0];
                        let x = path_mid.x;
                        let y = path_mid.y;
                        buildingsObject['link'][x + '/' + y] = 6;
                        linkPos = [x,y];
                    }
                    for(let pos of path){
                        buildingCosts.set(pos.x,pos.y,1);
                    }
                    buildingCosts.set(linkPos[0],linkPos[1],255);
                }
                let road_0 = [];
                let path0 = this.DM_path_sourceContainer_strategicCluster(new RoomPosition(containerPos[0][0],containerPos[0][1],roomName),new RoomPosition(strategicCluster[0],strategicCluster[1],roomName),buildingCosts);
                let path1 = this.DM_path_sourceContainer_strategicCluster(new RoomPosition(containerPos[1][0],containerPos[1][1],roomName),new RoomPosition(strategicCluster[0],strategicCluster[1],roomName),buildingCosts);
                road_0[0] = [path0[0].x,path0[0].y];
                road_0[1] = [path1[0].x,path1[0].y];
            
                //确定extension
                for(let i = 0;i < containerPos.length;i++){
                    let needLink = PathFinder.search(
                        new RoomPosition(containerPos[i][0],containerPos[i][1],roomName),
                        {pos : new RoomPosition(strategicCluster[0],strategicCluster[1],roomName),range : 2},
                        {
                            plainCost : 2,
                            swampCost : 10,
                            roomCallback:function(){
                                return buildingCosts;
                            }
                        }
                    ).path.length > 10;
                    for(let x = containerPos[i][0] - 1;x <= containerPos[i][0] + 1;x++){
                        for(let y = containerPos[i][1] - 1;y <= containerPos[i][1] + 1;y++){
                            if(x == containerPos[i][0] && y == containerPos[i][1])continue;
                            if(this.IsPointBetween([x,y],linkPos, containerPos[i]))continue;
                            if(x == road_0[0][0] && y == road_0[0][1])continue;
                            if(x == road_0[1][0] && y == road_0[1][1])continue;
                            if(x <= 1 || y <= 1 || x >= 48 || y >= 48){
                                continue;
                            }
                            if(terrain.get(x,y) != 1 && buildingCosts.get(x,y) != 255 && buildingCosts.get(x,y) != 1){
                                if(needLink && !linkPos[i]){
                                    linkPos[i] = [x,y]
                                    buildingsObject['link'][x + '/' + y] = 5 + i;
                                }else{
                                    extensions_pos.push(x,y);
                                    if(extension_3 > 0){
                                        buildingsObject['extension'][x + '/' + y] = 3;
                                        extension_3--;
                                    }else{
                                        buildingsObject['extension'][x + '/' + y] = 4;
                                        extension_4--;
                                    }
                                }
                                buildingCosts.set(x,y,255);                            
                            }
                        }   
                    }
                }
            }
        }
        //extension
        let distence_extension = 20;
        {
            let extensionPos = [[0,0],[-1,0],[0,1],[1,0],[0,-1]];
            let roadPos = [[-2,0],[-1,-1],[0,-2],[1,-1],[2,0],[1,1],[0,2],[-1,1]];
            let extensions_pos = [];
            let beginExtensionCount = 10;
            for(let x = center_energy[0] - distence_extension;x <= center_energy[0] + distence_extension;x++){
                for(let y = center_energy[1] - distence_extension;y <= center_energy[1] + distence_extension;y++){
                    if(this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y) <= 3){
                        continue;
                    }
                    if(x <= 1 || x >= 48 || y <= 1 || y >= 48){
                        continue;
                    }
                    let f = true;
                    for(let source of sources){
                        if(source.pos.getRangeTo(x,y) < 3){
                            f = false;
                            break
                        }
                    }
                    if(!f)continue;
                    for(let container of containerPos){
                        if(this.DM_XY_Distence(container[0],container[1],x,y) <= 2){
                            f = false;
                            break;
                        }
                    }
                    if(!f)continue;
                    if(x <= 4){
                        for(let ty = y - 3;ty <= y + 3;ty++){
                            if(terrain.get(0,ty) != 1){
                                f = false;
                                break;
                            }
                        }
                        if(!f)continue;
                    }
                    if(y <= 4){
                        for(let tx = x - 3;tx <= x + 3;tx++){
                            if(terrain.get(tx,0) != 1){
                                f = false;
                                break;
                            }
                        }
                        if(!f)continue;
                    }
                    if(x >= 46){
                        for(let ty = y - 3;ty <= y + 3;ty++){
                            if(terrain.get(49,ty) != 1){
                                f = false;
                                break;
                            }
                        }
                        if(!f)continue;
                    }
                    if(y >= 46){
                        for(let tx = x - 3;tx <= x + 3;tx++){
                            if(terrain.get(tx,49) != 1){
                                f = false;
                                break;
                            }
                        }
                        if(!f)continue;
                    }
                    for(let extensionPos_ of extensionPos){
                        let ex = extensionPos_[0] + x;
                        let ey = extensionPos_[1] + y
                        let cost = buildingCosts.get(ex,ey);
                        if(cost == 255 || cost == 1){
                            f = false;
                            break;
                        }
                    }
                    if(!f)continue;
                    extensions_pos.push([x,y,this.DM_XY_Distence(x,y,center_energy[0],center_energy[1],true)])
                }
            }

            extensions_pos.sort(function(a,b){
                return a[2] - b[2];
            })
            let beginExtensionLevel = 5;
            let i = 0;
            for(let extensionPos_1 of extensions_pos){
                if(beginExtensionCount == 0){
                    beginExtensionLevel++;
                    beginExtensionCount = 10;
                }
                if(beginExtensionLevel == 9){
                    break;
                }
                let x = extensionPos_1[0];
                let y = extensionPos_1[1];
                let f = true;
                for(let extensionPos_2 of extensionPos){
                    let cost = buildingCosts.get(extensionPos_2[0] + x,extensionPos_2[1] + y);
                    if(cost == 255 || cost == 1){
                        f = false;
                        break;
                    }
                }
                if(!f)continue;
                if((buildingCosts.get(x - 2,y) == 255 && buildingCosts.get(x + 2,y) == 255)
                || (buildingCosts.get(x,y - 2) == 255 && buildingCosts.get(x,y + 2) == 255)
                || (buildingCosts.get(x - 1,y - 1) == 255 && (buildingCosts.get(x - 1,y + 1) == 255 || buildingCosts.get(x + 1,y - 1) == 255 || buildingCosts.get(x + 1,y + 1) == 255 || (buildingCosts.get(x + 2,y) == 255 && buildingCosts.get(x - 2,y) == 255) || (buildingCosts.get(x,y + 2) == 255 && buildingCosts.get(x,y - 2) == 255)))
                || (buildingCosts.get(x - 1,y + 1) == 255 && (buildingCosts.get(x + 1,y + 1) == 255 || buildingCosts.get(x - 1,y - 1) == 255 || buildingCosts.get(x + 1,y - 1) == 255 || (buildingCosts.get(x + 2,y) == 255 && buildingCosts.get(x - 2,y) == 255) || (buildingCosts.get(x,y + 2) == 255 && buildingCosts.get(x,y - 2) == 255)))
                || (buildingCosts.get(x + 1,y - 1) == 255 && (buildingCosts.get(x + 1,y + 1) == 255 || buildingCosts.get(x - 1,y - 1) == 255 || (buildingCosts.get(x + 2,y) == 255 && buildingCosts.get(x - 2,y) == 255) || (buildingCosts.get(x,y + 2) == 255 && buildingCosts.get(x,y - 2) == 255)))
                || (buildingCosts.get(x + 1,y + 1) == 255 && (buildingCosts.get(x + 1,y - 1) == 255 || buildingCosts.get(x - 1,y + 1) == 255 || (buildingCosts.get(x + 2,y) == 255 && buildingCosts.get(x - 2,y) == 255) || (buildingCosts.get(x,y + 2) == 255 && buildingCosts.get(x,y - 2) == 255)))){
                    continue;
                }
                if(buildingCosts.get(x - 2,y) == 255 && terrain.get(x - 2,y) != 1
                ||buildingCosts.get(x + 2,y) == 255 && terrain.get(x + 2,y) != 1
                ||buildingCosts.get(x,y - 2) == 255 && terrain.get(x,y - 2) != 1
                ||buildingCosts.get(x,y + 2) == 255 && terrain.get(x,y + 2) != 1){
                    continue;
                }
                let path = PathFinder.search(
                    new RoomPosition(x,y,roomName),
                    {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                    {
                        plainCost : 2,
                        swampCost : 10,
                        roomCallback:function(){
                            return buildingCosts;
                        }
                    }
                ).path;
                if(path.length + 3 > extensionPos_1[2]){
                    continue;
                }
                beginExtensionCount -= 5;
                for(let pos of path){
                    if(buildingCosts.get(pos.x,pos.y) != 1){
                        buildingsObject['road'][pos.x + '/' + pos.y] = beginExtensionLevel;
                        buildingCosts.set(pos.x , pos.y,1);
                    }
                }
                for(let extensionPos_2 of extensionPos){
                    buildingsObject['extension'][(x + extensionPos_2[0]) + '/' + (y + extensionPos_2[1])] = beginExtensionLevel;
                    buildingCosts.set((x + extensionPos_2[0]) , (y + extensionPos_2[1]),255);
                }
                for(let roadPos_ of roadPos){
                    let road_x = x + roadPos_[0];
                    let road_y = y + roadPos_[1];
                    let cost = buildingCosts.get(road_x,road_y);
                    if(cost == 255 || cost == 1)continue;
                    if(this.DM_XY_Distence(road_x,road_y,center_energy[0],center_energy[1]) <= 3)continue;
                    buildingsObject['road'][road_x + '/' + road_y] = beginExtensionLevel;
                    buildingCosts.set(road_x , road_y,1);
                }
            }
        }
        //能量到中心道路
        {
            let roadCount1 = 0,roadCount2 = 0;
            let path1 = [],path2 = [],pathBest = [];
            let costs1 = new PathFinder.CostMatrix;
            let costs2 = new PathFinder.CostMatrix;
            for(let x = 0;x < 50;x++){
                for(let y = 0;y < 50;y++){
                    costs1.set(x,y,buildingCosts.get(x,y));
                    costs2.set(x,y,buildingCosts.get(x,y));
                }
            }
            for(let container of containerPos){
                let path = PathFinder.search(
                    new RoomPosition(container[0],container[1],roomName),
                    {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                    {
                        plainCost : 2,
                        swampCost : 10,
                        roomCallback:function(){
                            return costs1;
                        }
                    }
                ).path;
                path1.push(path);
                for(let pos of path){
                    if(costs1.get(pos.x,pos.y) != 1)roadCount1++;
                    costs1.set(pos.x,pos.y,1);
                }
            }
            let containerPos_ = containerPos.slice().reverse();
            for(let container of containerPos_){
                let path = PathFinder.search(
                    new RoomPosition(container[0],container[1],roomName),
                    {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                    {
                        plainCost : 2,
                        swampCost : 10,
                        roomCallback:function(){
                            return costs2;
                        }
                    }
                ).path;
                path2.push(path);
                for(let pos of path){
                    if(costs2.get(pos.x,pos.y) != 1)roadCount2++;
                    costs2.set(pos.x,pos.y,1);
                }
            }
            pathBest = roadCount1 <= roadCount2 ? path1 : path2;
            for(let path of pathBest){
                for(let pos of path){
                    buildingsObject['road'][pos.x + '/' + pos.y] = 3;
                    buildingCosts.set(pos.x,pos.y,1)
                }
            }
            
        }
        //补齐extension
        {
            let extensions_34 = [];
            if(extension_3 > 0 || extension_4 > 0){
                for(let x = center_energy[0] - distence_extension;x <= center_energy[0] + distence_extension;x++){
                    for(let y = center_energy[1] - distence_extension;y <= center_energy[1] + distence_extension;y++){
                        let f = true;
                        for(let source of sources){
                            if(source.pos.isNearTo(x,y)){
                                f = false;
                                break;
                            }
                            if(!f)break;
                        }
                        if(!f)continue;
                        let cost = buildingCosts.get(x,y);
                        if(cost == 255 || cost == 1){
                            continue;
                        }
                        if(this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y) <= 2){
                            continue;
                        }
                        if(this.DM_XY_Distence(x,y,center_energy[0],center_energy[1]) <= 3 && cost != 2){
                            continue;
                        }
                        if(x <= 1 || x >= 48 || y <= 1 || y >= 48){
                            continue;
                        }
                        if(x <= 4){
                            for(let ty = y - 3;ty <= y + 3;ty++){
                                if(terrain.get(0,ty) != 1){
                                    f = false;
                                    break;
                                }
                            }
                            if(!f)continue;
                        }
                        if(y <= 4){
                            for(let tx = x - 3;tx <= x + 3;tx++){
                                if(terrain.get(tx,0) != 1){
                                    f = false;
                                    break;
                                }
                            }
                            if(!f)continue;
                        }
                        if(x >= 46){
                            for(let ty = y - 3;ty <= y + 3;ty++){
                                if(terrain.get(49,ty) != 1){
                                    f = false;
                                    break;
                                }
                            }
                            if(!f)continue;
                        }
                        if(y >= 46){
                            for(let tx = x - 3;tx <= x + 3;tx++){
                                if(terrain.get(tx,49) != 1){
                                    f = false;
                                    break;
                                }
                            }
                            if(!f)continue;
                        }
                        for(let ex = x - 1;ex <= x + 1;ex++){
                            for(let ey = y - 1;ey <= y + 1;ey++){
                                if(buildingCosts.get(ex,ey) == 1){
                                    f = false;
                                    break;
                                }
                            }
                            if(!f)break;
                        }
                        if(f)continue;
                        extensions_34.push([x,y,this.DM_XY_Distence(x,y,center_energy[0],center_energy[1],true)])
                    }
                }
            }
            extensions_34.sort(function(a,b){
                return a[2] - b[2];
            })
            for(let extensionsPos of extensions_34){
                if(extension_3 > 0){
                    buildingsObject['extension'][extensionsPos[0] + '/' + extensionsPos[1]] = 3;
                    buildingCosts.set(extensionsPos[0], extensionsPos[1],255);
                    extension_3--;
                }else if(extension_4 > 0){
                    buildingsObject['extension'][extensionsPos[0] + '/' + extensionsPos[1]] = 4;
                    buildingCosts.set(extensionsPos[0], extensionsPos[1],255);
                    extension_4--;
                }else break;
            }
        }
        
        //other(战略集群到中心/矿到战略集群/lab到战略集群)
        {
            //战略集群
            let strategicClusterLength = [0,0,50];
            for(let x = strategicCluster[0] - 1;x <= strategicCluster[0] + 1;x++){
                for(let y = strategicCluster[1] - 1;y <= strategicCluster[1] + 1;y++){
                    let length = this.DM_XY_Distence(x,y,center_energy[0],center_energy[1],true);
                    if(length < strategicClusterLength[2]){
                        strategicClusterLength = [x,y,length];
                    }
                }
            }
            let strategicCluster_center_path = PathFinder.search(
                new RoomPosition(strategicClusterLength[0],strategicClusterLength[1],roomName),
                {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                {
                    plainCost : 2,
                    swampCost : 10,
                    roomCallback:function(){
                        return buildingCosts;
                    }
                }
            ).path;
            for(let i = 1;i < strategicCluster_center_path.length - 1;i++){
                let x = strategicCluster_center_path[i].x;
                let y = strategicCluster_center_path[i].y;
                buildingsObject['road'][x + '/' + y] = 4;
                buildingCosts.set(x,y,1);
            }
            //矿
            let mineral_storage_path = PathFinder.search(
                mineralPos,
                {pos : new RoomPosition(strategicCluster[0],strategicCluster[1],roomName) ,range : 2},
                {
                    plainCost : 10,
                    swampCost : 50,
                    roomCallback:function(){
                        return buildingCosts;
                    }
                }
            ).path;
            for(let i = 1;i < mineral_storage_path.length;i++){
                let x = mineral_storage_path[i].x;
                let y = mineral_storage_path[i].y;
                let cost = buildingCosts.get(x,y);
                if(cost != 1 && cost != 3){
                    buildingsObject['road'][x + '/' + y] = i == mineral_storage_path.length - 1 ? 4 : 6;
                    buildingCosts.set(x,y,1);
                }
            }
            //lab
            let lab_storage_path = PathFinder.search(
                new RoomPosition(labPos[0],labPos[1],roomName),
                {pos : new RoomPosition(strategicCluster[0],strategicCluster[1],roomName),range : 2},
                {
                    plainCost : 2,
                    swampCost : 10,
                    roomCallback:function(){
                        return buildingCosts;
                    }
                }
            ).path;
            for(let i = 0;i < lab_storage_path.length;i++){
                let x = lab_storage_path[i].x;
                let y = lab_storage_path[i].y;
                if(buildingCosts.get(x,y) != 1){
                    buildingsObject['road'][x + '/' + y] = 6;
                    buildingCosts.set(x,y,1);
                }
            }
        }
        //炮台
        {
            let distence = 15;
            let towerPos = [];
            for(let x = center_energy[0] - distence;x <= center_energy[0] + distence;x++){
                for(let y = center_energy[1] - distence;y <= center_energy[1] + distence;y++){
                    if(this.DM_XY_Distence(x,y,controller.pos.x,controller.pos.y) <= 3){
                        continue;
                    }
                    let cost = buildingCosts.get(x,y);
                    if(cost == 255 || cost == 1 || cost == 3){
                        continue;
                    }
                    if(x <= 4 || y <= 4 || x >= 45 || y >= 45){
                        continue;
                    }
                    let f = false;
                    for(let source of sources){
                        if(source.pos.isNearTo(x,y)){
                            f = true;
                            break;
                        }
                        if(f)break;
                    }
                    if(f)continue;
                    for(let rx = x - 1;rx <= x +1;rx++){
                        for(let ry = y - 1;ry <= y +1;ry++){
                            if(buildingCosts.get(rx,ry) == 1){
                                f = true;
                                break;
                            }
                        }
                        if(f)break;
                    }
                    if(!f)continue;
                    towerPos.push([x,y,this.DM_XY_Distence(x,y,center_energy[0],center_energy[1],true)])
                }
            }
            towerPos.sort(function(a,b){
                return a[2] - b[2];
            })
            let towerPos_ = [];
            for(let tower of towerPos){
                let x = tower[0];
                let y = tower[1];
                let path = PathFinder.search(
                    new RoomPosition(x,y,roomName),
                    {pos : new RoomPosition(center_energy[0],center_energy[1],roomName),range : 3},
                    {
                        plainCost : 2,
                        swampCost : 10,
                        roomCallback:function(){
                            return buildingCosts;
                        }
                    }
                ).path;
                if(path.length < 10){
                    towerPos_.push([x,y]);
                }
            }
            towerPos = towerPos_;
            buildingsObject['tower'][towerPos[0][0] + '/' + towerPos[0][1]] = 5;
            buildingsObject['tower'][towerPos[1][0] + '/' + towerPos[1][1]] = 7;
            buildingsObject['tower'][towerPos[2][0] + '/' + towerPos[2][1]] = 8;
            buildingsObject['tower'][towerPos[3][0] + '/' + towerPos[3][1]] = 8;
            buildingsObject['tower'][towerPos[4][0] + '/' + towerPos[4][1]] = 8;
            buildingsObject['rampart'][towerPos[0][0] + '/' + towerPos[0][1]] = 5;
            buildingsObject['rampart'][towerPos[1][0] + '/' + towerPos[1][1]] = 7;
            buildingsObject['rampart'][towerPos[2][0] + '/' + towerPos[2][1]] = 8;
            buildingsObject['rampart'][towerPos[3][0] + '/' + towerPos[3][1]] = 8;
            buildingsObject['rampart'][towerPos[4][0] + '/' + towerPos[4][1]] = 8;
            buildingCosts = this.DM_cost255(buildingCosts,buildingsObject);
        }
        Memory.rooms[roomName]['DM_layout']['buildings'] = buildingsObject;

        this.VisualBuilding(roomName,buildingCosts,false);
        console.log("布局计算消耗CPU:" + (Game.cpu.getUsed() - beginCpu).toFixed(2))
        return true;
    },
    //绘图
    Visual(costs,roomName){
        return;
        let visual = new RoomVisual(roomName);
        let color;
        for(let x = 0;x < 50;x++){
            for(let y = 0;y < 50;y++){
                switch(costs.get(x,y)){
                    case 250 :
                        color = '#ffffff';
                        break;
                    case 251 :
                        color = '#300000';
                        break;
                    case 252 :
                        color = '#005000';
                        break;
                    default :
                        continue;
                }
                visual.rect(x - 0.5,y - 0.5,1,1,{
                    fill : color,
                    opacity : 0.3
                })
            }
        }
    },
    //能量仓库到战略集群寻路
    DM_path_sourceContainer_strategicCluster(container,center,costs){
        return PathFinder.search(
            container,
            {pos : center,range : 2},
            {
                plainCost: 2,
                swampCost: 10,
                roomCallback: function() {
                    return costs;
                }
            }
        ).path;
    },
    //设置cost255
    DM_cost255(costs,buildings){
        for(let type in buildings){
            if(type == 'rampart')continue;
            for(let str in buildings[type]){
                let pos = str.split('/');
                costs.set(parseInt(pos[0]),parseInt(pos[1]),type == 'road' ? 1 : type == 'container' ? 3 : 255);
            }
        }
        return costs;
    },
    //绘制布局
    VisualBuilding(roomName,buildingCosts,bool){
        let buildings = Memory.rooms[roomName]['DM_layout']['buildings'];
        let visual = new RoomVisual(roomName);
        for(let type in buildings){
            if(type == 'rampart')continue;
            for(let str in buildings[type]){
                let pos = str.split('/');
                let x = parseInt(pos[0]);
                let y = parseInt(pos[1]);
                switch (type) {
                    case 'spawn':
                        visual.circle(x, y, { fill: 'white', radius: 0.65, opacity: 0.6 })
                        visual.circle(x, y, { fill: 'black', radius: 0.55, opacity: 0.8 })
                        visual.circle(x, y, { fill: 'yellow', radius: 0.35, opacity: 0.8 })
                        break;
                    case 'extension':
                        visual.circle(x, y, { fill: 'green', radius: 0.4, opacity: 0.7 })
                        visual.circle(x, y, { fill: 'black', radius: 0.35, opacity: 0.7 })
                        visual.circle(x, y, { fill: 'yellow', radius: 0.3, opacity: 0.7 })
                        break;
                    case 'link':
                        visual.poly([[x, y - 0.45], [x - 0.35, y], [x, y + 0.45], [x + 0.35, y], [x, y - 0.45], [x - 0.35, y]]
                            , { stroke: 'green', opacity: 0.8, strokeWidth: 0.07 })
                        visual.poly([[x, y - 0.3], [x - 0.25, y], [x, y + 0.3], [x + 0.25, y], [x, y - 0.3], [x - 0.25, y]]
                            , { stroke: 'black', opacity: 0.8, strokeWidth: 0.07, fill: 'grey' })
                        break;
                    case 'road':
                        visual.circle(x, y, { fill: 'grey', radius: 0.1, opacity: 1 })
                        break;
                    case 'constructedWall':
                        visual.circle(x, y, { fill: 'black', radius: 0.5, opacity: 0.6 })
                        break;
                    case 'storage':
                        visual.rect(x - 0.5, y - 0.7, 1, 1.4, { stroke: 'green', fill: 'black', opacity: 0.8 })
                        visual.rect(x - 0.4, y - 0.5, 0.8, 0.5, { fill: 'grey', opacity: 0.8 })
                        visual.rect(x - 0.4, y, 0.8, 0.5, { fill: 'yellow', opacity: 0.8 })
                        break;
                    case 'observer':
                        visual.circle(x, y, { fill: 'green', radius: 0.5, opacity: 0.8 })
                        visual.circle(x, y, { fill: 'black', radius: 0.45, opacity: 1 })
                        visual.circle(x + 0.2, y, { fill: 'green', radius: 0.25, opacity: 0.8 })
                        break;
                    case 'powerSpawn':
                        visual.circle(x, y, { fill: 'white', radius: 0.8, opacity: 0.6 })
                        visual.circle(x, y, { fill: 'red', radius: 0.75, opacity: 0.8 })
                        visual.circle(x, y, { fill: 'black', radius: 0.65, opacity: 0.8 })
                        visual.circle(x, y, { fill: 'red', radius: 0.4, opacity: 0.8 })
                        break;
                    case 'extractor':
                        visual.circle(x, y, { stroke: 'green', strokeWidth: 0.2, radius: 0.74, fill: false, lineStyle: 'dashed' })
                        break;
                    case 'terminal':
                        visual.poly([[x, y - 0.85], [x - 0.5, y - 0.5], [x - 0.85, y], [x - 0.5, y + 0.5], [x, y + 0.85], [x + 0.5, y + 0.5], [x + 0.85, y], [x + 0.5, y - 0.5], [x, y - 0.85], [x - 0.5, y - 0.5]]
                            , { stroke: 'green', opacity: 1, strokeWidth: 0.07 })
                        visual.poly([[x, y - 0.75], [x - 0.45, y - 0.45], [x - 0.75, y], [x - 0.45, y + 0.45], [x, y + 0.75], [x + 0.45, y + 0.45], [x + 0.75, y], [x + 0.45, y - 0.45], [x, y - 0.75], [x - 0.45, y - 0.45]]
                            , { fill: 'grey', stroke: 'black', opacity: 1, strokeWidth: 0.07 })
                        visual.rect(x - 0.4, y - 0.4, 0.8, 0.8, { stroke: 'black', strokeWidth: 0.1, fill: 'yellow', opacity: 0.8 })
                        break;
                    case 'lab':
                        visual.circle(x, y, { fill: 'green', radius: 0.5, opacity: 0.8 })
                        visual.rect(x - 0.4, y + 0.2, 0.8, 0.3, { fill: 'green', opacity: 0.8 })
                        visual.circle(x, y, { fill: 'black', radius: 0.45, opacity: 0.8 })
                        visual.circle(x, y, { fill: 'white', radius: 0.35, opacity: 0.8 })
                        visual.rect(x - 0.35, y + 0.25, 0.7, 0.2, { fill: 'black', opacity: 0.8 })
                        visual.rect(x - 0.2, y + 0.3, 0.4, 0.1, { fill: 'yellow', opacity: 0.8 })
                        break;
                    case 'container':
                        visual.rect(x - 0.25, y - 0.3, 0.5, 0.6, { stroke: 'black', strokeWidth: 0.1, fill: 'yellow', opacity: 0.8 })
                        break;
                    case 'nuker':
                        visual.poly([[x, y - 1.5], [x - 0.7, y], [x - 0.7, y + 0.7], [x + 0.7, y + 0.7], [x + 0.7, y], [x, y - 1.5], [x - 0.7, y]]
                            , { stroke: 'green', opacity: 0.8, strokeWidth: 0.2 })
                        visual.poly([[x, y - 1.3], [x - 0.6, y], [x - 0.6, y + 0.6], [x + 0.6, y + 0.6], [x + 0.6, y], [x, y - 1.3], [x - 0.6, y], [x + 0.6, y]]
                            , { stroke: 'black', opacity: 0.8, strokeWidth: 0.2, fill: 'grey' })
                        break;
                    case 'factory':
                        visual.circle(x, y, { fill: 'black', radius: 0.6, opacity: 1 })
                        visual.line(x - 0.2, y - 0.8, x - 0.2, y + 0.8, { color: 'black', opacity: 0.8 })
                        visual.line(x + 0.2, y - 0.8, x + 0.2, y + 0.8, { color: 'black', opacity: 0.8 })
                        visual.line(x - 0.8, y - 0.2, x + 0.8, y - 0.2, { color: 'black', opacity: 0.8 })
                        visual.line(x - 0.8, y + 0.2, x + 0.8, y + 0.2, { color: 'black', opacity: 0.8 })
                        break;
                    case 'tower':
                        visual.circle(x, y, { stroke: 'green', fill: false, radius: 0.6, opacity: 0.8 })
                        visual.circle(x, y, { fill: 'black', radius: 0.55, opacity: 0.9 })
                        visual.rect(x - 0.35, y - 0.25, 0.7, 0.5, { fill: 'grey', opacity: 0.8 })
                        visual.rect(x - 0.25, y - 0.85, 0.5, 0.6, { fill: 'black', opacity: 0.8 })
                        visual.rect(x - 0.2, y - 0.8, 0.4, 0.5, { fill: 'grey', opacity: 0.8 })
                        break;
                }
            }
        }
        let roadArr = new Array();
        let i = 0;
        for(let roadPos in buildings['road']){
            let str = roadPos.split('/')
            roadArr[i++] = {x : parseInt(str[0]),y : parseInt(str[1])}
        }
        for(let pos of roadArr){
            for(let pos_ of roadArr){
                if(pos == pos_){
                    continue;
                }
                if(Math.abs(pos.x - pos_.x) <= 1 && Math.abs(pos.y - pos_.y) <= 1){
                    visual.line(pos.x, pos.y, pos_.x, pos_.y, { color: 'grey', opacity: 1 ,width : 0.2})
                }
            }
        }
        for(let str in buildings['rampart']){
            let pos = str.split('/');
            visual.rect(parseInt(pos[0]) - 0.5, parseInt(pos[1]) - 0.5, 1, 1, { stroke: 'green', fill: 'green', opacity: 0.3 })
        }
        for(let type in buildings){
            for(let str in buildings[type]){
                let level = buildings[type][str];
                let pos = str.split('/');
                let x = parseInt(pos[0]);
                let y = parseInt(pos[1]);
                visual.text(level,x + 0.4,type == 'rampart' ? y + 0.2 : y + 0.5,{
                    font : 0.3
                })
            }
        }
        if(bool){
            for(let x = 0;x < 50;x++){
                for(let y = 0;y < 50;y++){
                    visual.text(buildingCosts.get(x,y),x ,y + 0.45 ,{
                        font : 0.2,
                        color : 'yellow'
                    })
                }
            }
        }
        Memory.rooms[roomName]['DM_layout']['visual'] = visual.export();
    },
    //判断距离
    DM_XY_Distence(x1,y1,x2,y2,bool){
        if(bool){
            return Math.sqrt((x1 - x2)*(x1 - x2) + (y1 - y2) * (y1 - y2));
        }else{
            return Math.max(Math.abs(x1 - x2),Math.abs(y1 - y2));
        }
    },
    //该位置是否在俩点之间
    IsPointBetween(point, point1, point2) {
        var minX = Math.min(point1[0], point2[0]);
        var maxX = Math.max(point1[0], point2[0]);
        var minY = Math.min(point1[1], point2[1]);
        var maxY = Math.max(point1[1], point2[1]);
        return (point[0] > minX && point[0] < maxX && point[1] > minY && point[1] < maxY);
    }
}
//控制台
const dmConsole = {
    help: '大猫bot\n'
        + '种田bot,会自动开外矿,开新房需要手动操作\n'
        + '控制台输入以下代码以获取具体操作:\n'
        + '    playerHelp     :   对玩家的操作\n'
        + '    shardHelp      :   对shard的操作\n'
        + '    roomHelp       :   对房间的操作\n'
        + '    creepHelp      :   对爬爬的操作\n'
        + '    marketHelp     :   对市场的操作\n'
        + '    powerCreepHelp :   对抛瓦爬的操作\n'
    , playerHelp: ''
    , shardHelp: ''
    , roomHelp: '房间操作:\n'
        + '查看房间:\n    '
        + '    room.show([roomName])\n'
        + '    显示当前shard的所有房间    [roomName]显示此房间状态(可选填)\n'
        + '    显示当前shard的所有房间    [roomName]显示此房间状态(可选填)\n'
        + '房间布局[插旗子]\n'
        + '    旗子:visual   目标房间布局[目标房间任意位置]\n'
        + '    旗子:c        插在控制器位置\n'
        + '    旗子:s1       插在能量位置\n'
        + '    旗子:s2       插在第二个能量位置(没有就不用插)\n'
        + '    旗子:m        插在矿物位置\n'
        + '添加新房间:\n'
        + '    room.add(roomName,[type],[centerPos])\n'
        + '    [roomName:房间名字]\n'
        + '    [type:布局类型,不填默认大猫布局(\'man\'手动布局,\'dm\'大猫布局)]\n'
        + '    [centerPos:房间中心数组[x,y],不填则默认自动]\n'
        + '    例子:room.add(\'E17S57\',\'dm\',[25,25])\n'
        + '    也可以插旗子:\n'
        + '        旗子名字:\n'
        + '            addRoom                          [手动布局]\n'
        + '            addRoom/dm 或者 addRoom/dm/false  [大猫自动布局(自动找中心)]\n'
        + '            addRoom/dm/true                  [大猫自动布局(旗子位置即为中心)]\n'
        + '删除房间:\n'
        + '    room.delete(roomName,[bool])\n'
        + '    [roomName:房间名字]\n'
        + '    [bool:是否unclaim,不填或false为只删除内存不unclaim]\n'
        + '    例子:room.delete(\'E17S57\',true)\n'
    , creepHelp: ''
    , marketHelp: ''
    , powerCreepHelp: ''
}
//房间
const dmRoom = {
    //查看房间，不输入房间号则显示所有房间
    show(roomName) {
        try {
            if (roomName) {
                let room = Memory.rooms[roomName];
                if (!room) {
                    return '房间(' + HTML.Href(roomName) + ')没有占领'
                } else {
                    let room = Game.rooms[roomName]
                    if(!room){
                        return '房间(' + HTML.Href(roomName) + ')没有占领'
                    }
                    let str = '查看房间[' + HTML.Href(roomName) + ']\n';
                    let controller = room.controller;
                    let storage = room.storage;
                    let terminal = room.terminal;
                    str += '    level:' + controller.level + '\n';
                    str += '    energy:' + room.energyAvailable + '/' + room.energyCapacityAvailable + '\n';
                    str += '    仓库:' + (storage?(100 * storage.store.getUsedCapacity() / storage.store.getCapacity()).toFixed(2) + "%":'无');
                    str += '\n    终端:' + (terminal?(100 * terminal.store.getUsedCapacity() / terminal.store.getCapacity()).toFixed(2) + "%":'无')
                    return str;
                }
            } else {
                var str = '此shard已占领房间数:' + Object.keys(Memory.rooms).length + '(点击按钮以复制代码)\n红色代表没占领,绿色代表已占领\n';
                for(let roomName in Memory.rooms){
                    str += HTML.Button_room_show(roomName,Game.rooms[roomName]);
                }
                return str;
            }
        } catch (error) {
            return '查看房间' + roomName + '报错:\n    ' + error;
        }
    },
    //添加房间
    add(roomName,type,centerPos) {
        let str = HTML.Href(roomName);
        if(!type){
            type = 'dm';
        }
        if(centerPos){
            if(!Array.isArray(centerPos) || centerPos.length > 2){
                return roomName + '中心参数错误'
            }
        }
        let roomMemory = Memory.rooms[roomName]
        if (roomMemory) {
            return '已占有该房间' + str;
        }
        let room = Game.rooms[roomName];
        if (!room) {
            return '该房间无视野' + str;
        }
        let controller = room.controller;
        let level = controller.level;
        if (!controller) {
            return '该房间无控制器' + str;
        }
        //房间内存
        let memory = {};
        //基础配置
        let config = {};
        {
            //level
            config['level'] = level;
            //link已用数
            config['linkCount'] = 0;
            //控制器升级
            config['controllerUp'] = false;
            //布局
            config['layout'] = {};
            config['layout']['type'] = type;
            config['layout']['building'] = {};
            if(type == 'dm')config['layout']['layerIndexRoomMemory'] = true;
            //防御
            let defense = {};
            defense = {};
            defense['begin'] = false;
            defense['target'] = [];
            config['defense'] = defense;
            //维护
            let repair = {};
            repair = {};
            repair['begin'] = false;
            repair['tower'] = false;
            repair['creep'] = DM.CreepName();
            repair['target'] = [];
            config['repair'] = repair;
            //矿
            let mineral = room.find(FIND_MINERALS)[0];
            let _mineral = {};
            _mineral['type'] = mineral.mineralType;
            _mineral['id'] = mineral.id;
            _mineral['extractor'] = false;
            _mineral['tick'] = 0;
            _mineral['creep'] = DM.CreepName();
            config['mineral'] = _mineral;
            //spawn
            config['spawn'] = [];
            for(let spawnName in Game.spawns){
                let spawn = Game.spawns[spawnName];
                if(spawn.room.name == roomName){
                    config['spawn'].push(spawn.id);
                }
            }
            //需要能量的建筑
            let needEnergyBuildings = {};
            needEnergyBuildings = {};
            needEnergyBuildings['extension'] = [];
            needEnergyBuildings['tower'] = [];
            config['needEnergyBuildings'] = needEnergyBuildings;
            
        }
        
        //废墟
        let ruin = {};
        let ruinEnergy = 0;
        room.find(FIND_RUINS, { filter: r => r.store.getUsedCapacity() > 0 }).forEach(r => {
            if (r.store[e] > 0) {
                ruinEnergy += r.store[e];
            }
            if (r.store.getUsedCapacity() != r.store[e]){
                ruin['other'] = true;
            }
        });
        ruin['energy'] = ruinEnergy;

        
        //爬爬
        let creep = {};
        {
            //房间内
            let home = {};
            home = {};
            home['harvest'] = {}
            home['harvest']['name'] = [];
            home['harvest']['num'] = 0;
            home['carry'] = {};
            home['carry']['name'] = [];
            home['up'] = {};
            home['up']['name'] = [];
            home['build'] = {};
            home['build']['name'] = [];
            home['build']['num'] = 0;
            home['wall'] = {};
            home['wall']['name'] = [];
            home['defender'] = {};
            home['defender']['name'] = [];
            creep['home'] = home;
            //外矿
            creep['outEnergy'] = {};
            //九房
            creep['9Room'] = {};
            //过道
            creep['aisle'] = {};
            creep['aisle']['power'] = {};
            creep['aisle']['deposit'] = {};
            //任务
            creep['task'] = {};
            //初始化房间内爬爬
            creep['home']['carry']['num'] = HomeCreepNum[level]['carry'];
            creep['home']['up']['num'] = HomeCreepNum[level]['up'];
            creep['home']['build']['num'] = room.find(FIND_MY_CONSTRUCTION_SITES).length > 0 ? HomeCreepNum[level]['build'] : 0;
        }
        //能量
        let source = {};
        const terrain = new Room.Terrain(roomName)
        room.find(FIND_SOURCES).forEach(s=>{
            //初始化
            let id = s.id;
            source[id] = {};
            source[id]['harvestNum'] = 0;
            source[id]['pos'] = s.pos;
            source[id]['creep'] = [];
            source[id]['container'] = 0;
            source[id]['link'] = 0;
            //矿位数量
            for(let x = s.pos.x - 1;x <= s.pos.x + 1;x++){
                for(let y = s.pos.y - 1;y <= s.pos.y + 1;y++){
                    if (y == s.pos.y && x == s.pos.x) continue
                    const tile = terrain.get(x, y);
                    if (tile == TERRAIN_MASK_WALL) continue
                    source[id]['harvestNum']++;
                }
            }
            if(source[id]['harvestNum'] > 3)source[id]['harvestNum'] = 3;
            creep['home']['harvest']['num'] += source[id]['harvestNum'];
        })
        //lab
        let lab = {};
        lab['type'] = 0;
        lab['amount'] = 0;
        lab['labs'] = [];

        //factory
        let factory = {};
        factory.id = null;

        //外矿
        let outEnergy = {};
        outEnergy['blacklist'] = [];
        outEnergy['obCreep'] = DM.CreepName();
        

        memory['config'] = config;
        memory['ruin'] = ruin; 
        memory['creep'] = creep;
        memory['source'] = source;
        memory['lab'] = lab;
        memory['factory'] = factory;
        memory['outEnergy'] = outEnergy;
        Memory.rooms[roomName] = memory;
        
        if(type == 'dm'){
            if(!DM_automatic_Layout.DM_layout(roomName,null,centerPos)){
                let memory = {};
                memory = Memory.rooms[roomName]['DM_layout'];
                Memory.rooms[roomName] = {};
                Memory.rooms[roomName]['DM_layout'] = memory;
                let visualFlag = Game.flags['visual'];
                if(!visualFlag){
                    new RoomPosition(25,25,roomName).createFlag('visual');
                }else{
                    visualFlag.setPosition(new RoomPosition(25,25,roomName));
                }
                return '布局失败';
            }
            let visualFlag = Game.flags['visual'];
            if(!visualFlag){
                new RoomPosition(25,25,roomName).createFlag('visual');
            }else{
                visualFlag.setPosition(new RoomPosition(25,25,roomName));
            }
        }
        return '房间' + str + '添加成功,布局:' + type;
    },
    //删除房间，是否unclaim房间
    delete(roomName, bool) {
        let str = HTML.Href(roomName);
        if (!Memory.rooms[roomName]) {
            return '内存中没找到该房间' + str;
        } else {
            if (bool) {
                Game.rooms[roomName].controller.unclaim();
                str += '并unlcaim'
            }
            delete Memory.rooms[roomName];
            let visualFlag = Game.flags['visual'];
            if(visualFlag && visualFlag.pos.roomName == roomName){
                visualFlag.remove();
            }
            return '已删除该房间内存' + str;
        }
    }
}
const DM = {
    //爬爬随机名字
    CreepName(){
        let n = Math.floor(10 + Math.random() * 10)
        let name = Memory.player['name'];
        for (var i = 0; i < n; i++) {
            let type = Math.ceil(Math.random() * 3);
            switch (type) {
                case 1:
                    name += (Math.floor(Math.random() * 10))
                    break
                case 2:
                    name += (String.fromCharCode(65 + Math.ceil(Math.random() * 25)))
                    break;
                case 3:
                    name += (String.fromCharCode(97 + Math.ceil(Math.random() * 25)))
                    break;
            }
        }
        return name;
    },
    //'x/y'变[x,y]数组
    strToArr(str){
        let pos = str.split('/');
        return [parseInt(pos[0]),parseInt(pos[1])]
    },
}
global.help = dmConsole.help;
global.roomHelp = dmConsole.roomHelp;
global.room = dmRoom;
console.log("上传代码消耗cpu:" + (Game.cpu.getUsed() - upDataCpu).toFixed(2))
