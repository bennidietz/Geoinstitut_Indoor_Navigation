const to_floor_plans_folder = "floor_plans/";
const to_symbols_folder = "symbols/";
const from_room_param_str = "from_room";
const to_room_param_str = "to_room";
const language_param_str = "lang";

var current_url = new URL(window.location);
var from_room = current_url.searchParams.get(from_room_param_str);
var to_room = current_url.searchParams.get(to_room_param_str);
var lang = current_url.searchParams.get(language_param_str);
var screen_width = window.innerWidth;
if (to_room) {
    var to_level = to_room.substr(0, 1);
}

var institutes = {};
var rooms_order_after_level = {};
var rooms_order_after_roomnr = {};
var paths = {};
var etagen_nummer = null;
var shortest_nav_path = null;

var smartphone = true;
var mapfullwidth = true;
console.log("width: " + window.innerWidth + " - height: " + window.innerHeight)
if (window.innerWidth > window.innerHeight) {
    smartphone = false;
}
if (window.innerWidth * 1.7 > window.innerHeight) {
    mapfullwidth = false;
}
console.log("Smartphone: " + smartphone)
console.log("Map full width: " + mapfullwidth)

var language_index = 0; // taking German as the default value
if (lang) {
    if (stringsAreEqual(lang, "en")) {
        language_index = 1;
    } else if (stringsAreEqual(lang, "es")) {
        language_index = 2;
    }
    $("#language_spinner").val(lang);
} else {
    lang = "de";
}

var from_room_object = null;
var to_room_object = null;

$('#language_spinner').on('change', function() {
    var current_loc = window.location + "";
    var end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + this.value;
    if (from_room) {
        end_loc += "&" + from_room_param_str + "=" + from_room;
    }
    if (to_room) {
        end_loc += "&" + to_room_param_str + "=" + to_room;
    }
    window.location = end_loc;
});

class Room {
    constructor(json) {
        this.room_nr = json["no"];
        this.category = json["category"];
        this.institute = institutes[json["institute"]];
        this.level = json["level"];
        this.door_coordinates = [Number(json["doorX"]), Number(json["doorY"])];
        this.spatial_extend = [
            [json["x1"], json["y1"]],
            [json["x2"], json["y2"]]
        ];
        this.openingHours = [json["hoursStart"], json["hoursEnd"]];
        this.description = json["description"];
    }
}

class Institute {
    constructor(json) {
        this.name = json["name_de"];
        this.json = json;
        this.getName();
        this.id = json["id"];
    }

    getName() {
        if (stringsAreEqual(lang, "en")) {
            this.name = this.json["name_en"];
        } else if (stringsAreEqual(lang, "es")) {
            this.name = this.json["name_es"];
        }
    }
}

class Paths {
    constructor(level, json) {
        this.startPoint = [Number(json["start"][0]), Number(json["start"][1])];
        this.endPoint = [Number(json["end"][0]), Number(json["end"][1])];
        this.level = level;
        this.direction = [roundWithTwoDecimals(this.endPoint[0] - this.startPoint[0]), roundWithTwoDecimals(this.endPoint[1] - this.startPoint[1])]; // direction of vector
    }
}

function getNearestPointOnPath(pointA, pathA) {
    var start_coor = pathA.startPoint;
    var direction = pathA.direction;
    // source: https://www.youtube.com/watch?v=mdtJjvsYdQg
    var zwischen = [start_coor[0] - pointA[0], start_coor[1] - pointA[1]];
    zwischen = zwischen[0] * direction[0] + zwischen[1] * direction[1]; // Skalarprodukt von Differenz und Richtungvektor
    var sp_rv_vr = direction[0] * direction[0] + direction[1] * direction[1];
    var r = (-1) * zwischen / sp_rv_vr;
    if (r > 1) r = 1;
    if (r < 0) r = 1; // abfangen, damit der Punkt nicht außerhalb der Linie liegt
    return resultierender_punkt = getCertainPointOnPaths(start_coor, direction, r);
}

function distanceBetweenTwoPoints(start_coor, end_coor) {
    return roundWithTwoDecimals(Math.sqrt(Math.pow((start_coor[0] - end_coor[0]), 2) + Math.pow((start_coor[1] - end_coor[1]), 2)));
}

function roundWithTwoDecimals(number) {
    return Math.round(number * 100) / 100;
}

function getCertainPointOnPaths(start_coor, direction, r) {
    return [roundWithTwoDecimals(start_coor[0] + direction[0] * r), roundWithTwoDecimals(start_coor[1] + direction[1] * r)];
}

function api(type, query) {
    var authorization_key = '1234';
    var url = 'https://christian-terbeck.de/projects/ba/request.php';

    $.ajax({
        type: 'POST',
        url: url,
        data: { authorization_key: authorization_key, type: type, data: query },
        timeout: 60000,
        success: function(data) {
            if (data.status == 'success') {
                //console.log(data)
                if (stringsAreEqual(query, "all") && stringsAreEqual(type, "rooms")) {
                    for (var i in data) {
                        if (!rooms_order_after_level.hasOwnProperty(data[i]["level"])) {
                            rooms_order_after_level[data[i]["level"]] = [];
                        }
                        if (data[i].hasOwnProperty("no")) {
                            var room = new Room(data[i]);
                            rooms_order_after_level[data[i]["level"]].push(room)
                            rooms_order_after_roomnr[data[i]["no"]] = room;
                        }
                    }
                    onRoomsLoaded();
                } else if (stringsAreEqual(query, "all") && stringsAreEqual(type, "institutes")) {
                    for (var i in data) {
                        if (data[i].hasOwnProperty("name_de")) {
                            institutes[data[i]["id"]] = new Institute(data[i])
                        }
                    }
                    api("rooms", "all")
                }
            }
        },
        error: function(data) {

            console.log('unable to connect: ' + data);
        }
    });
}

$(function() {
    storeRoomsOfBuilding();
});

function onRoomsLoaded() {
    // rooms from database are loaded
    from_room_object = rooms_order_after_roomnr[from_room];
    to_room_object = rooms_order_after_roomnr[to_room];

    document.title = strings["title_application"][language_index];
    $("#label_cancel").text(strings["cancel"][language_index])
    $("#label_next_step").text(strings["next_step"][language_index])
    $("#etagen_btn1").text(strings["floor_1"][language_index])
    $("#etagen_btn2").text(strings["floor_2"][language_index])
    $("#etagen_btn3").text(strings["floor_3"][language_index])
    $("#etagen_btn4").text(strings["floor_4"][language_index])
    $("#etagen_btn5").text(strings["floor_5"][language_index])
    $("#etagen_btn6").text(strings["floor_6"][language_index])
    $("#etagen_btn7").text(strings["floor_7"][language_index])
    if (from_room_object) {
        etagen_nummer = from_room_object.level;
        $("#label_from_room").text(strings["from_room"][language_index])
        $("#value_from_room").text(from_room)
            // get level of room
        $("#label_level").text(strings["level"][language_index])
        $("#value_level").text($("#etagen_btn" + Number(from_room_object.level)).text())
        $("#etagen_btn" + Number(from_room_object.level)).removeClass("btn-default").addClass("btn-danger");
        if (!to_room_object) {
            setImageWithoutRoute(from_room_object.level, null);
            $("#next_step").remove();
            $("#label_cancel").text(strings["reset_position"][language_index])
        } else {
            // TODO: set image with route
            calculateRoute(from_room_object, to_room_object);
        }
    } else {
        setImageWithoutRoute(2, null);
        etagen_nummer = 2;
        if (!to_room_object) {
            $(".footer").css("display", "none")
        }
    }
    if (to_room_object) {
        $("#label_to_room").text(strings["to_room"][language_index])
        $("#value_to_room").text(to_room)
        $("#etagen_btn" + (Number(to_room_object.level))).removeClass("btn-default").addClass("btn-success");

        // no autocomplete input needed
        $(".autocomplete").css("display", "none");
    } else {
        $(".arrow_table").css("display", "none");
        $("#autocomplete_search").attr("placeholder", strings["autocomplete_placeholder"][language_index]);
        var autocomplete_options = [];
        for (var i in rooms_order_after_roomnr) {
            autocomplete_options.push(i + " - " + rooms_order_after_roomnr[i]["institute"]["name"])
        }
        autocomplete(document.getElementById("autocomplete_search"), autocomplete_options);
    }
    if (!smartphone) {
        $('.header').removeClass('header').addClass('header_desktop');
        $('.labels_header_table').removeClass('labels_header_table').addClass('labels_header_table_desktop');
        $('.cancel_table_field').removeClass('cancel_table_field').addClass('cancel_table_field_desktop');
        $('.next_step_table_field').removeClass('next_step_table_field').addClass('next_step_table_field_desktop');
        $('.labels_footer_table').removeClass('labels_footer_table').addClass('labels_footer_table_desktop');
    } else {
        $(".etagen_btn").css("height", "70");
        $(".etagen_btn").css("padding-top", "12");
        $(".etagen_btn").css("font-size", "1.8em");
    }
    if (mapfullwidth) {
        $(".arrow_table").css("maxWidth", window.innerHeight);
        $("#arrow").css("maxWidth", (window.innerHeight - window.innerWidth) / 3);
    } else {
        $(".arrow_table").css("maxWidth", "50%");
    }
}

function calculateRoute(roomA, roomB) {
    var level_string = "1OG";
    var detailsPathA = getDetailsOfNearestPath(roomA.door_coordinates, paths[level_string]);
    var detailsPathB = getDetailsOfNearestPath(roomB.door_coordinates, paths[level_string]);

    shortest_nav_path = getShortestPathBetweenPointsOnPaths(detailsPathA["point"], detailsPathA["path_index"], detailsPathB["point"], detailsPathB["path_index"], paths[level_string]);
    if (etagen_nummer == from_room_object.level || etagen_nummer == to_room_object.level) {
        shortest_nav_path["points_on_route"].splice(0, 0, from_room_object.door_coordinates);
        shortest_nav_path["points_on_route"].push(to_room_object.door_coordinates)
    }
    displayFullNavigation(from_room_object.level, shortest_nav_path);
}

function displayDestinationReached(direction_of_desination) {
    $("#arrow").css("display", "none");
    $("#distance").css("display", "none");
}

function displayArrow(direction, length) {
    length = Math.round(length * 36 / 100)
    var file = "symbols/";
    switch (direction) {
        case 0:
            //top
            file += "arrow_top";
            break;
        case 1:
            //right
            file += "arrow_right";
            break;
        case 2:
            //bottom
            file += "arrow_down";
            break;
        case 3:
            //left
            file += "arrow_left";
            break;
        default:
            break;
    }
    $("#arrow").attr("src", file + ".png");
    $("#distance").text(length + " m");
}

function getShortestPathBetweenPointsOnPaths(pointA, pathA_index, pointB, pathB_index, path_array) {
    var path_connections = getConectionArrayPaths(path_array);
    var all_possible_paths = getAllPossiblePaths(path_connections, [
        [Number(pathA_index)]
    ], Number(pathB_index));
    return getShortestPath(path_array, all_possible_paths, pointA, pointB);
}

function getShortestPath(all_paths, all_paths_indexes, pointA, pointB) {
    var distance_path = 1000; // unrealistic maximal distance
    var shortest_path = {
        "points_on_route": null,
        "dist": null,
        "directions": null,
    }
    for (var j in all_paths_indexes) {
        var distances = [];
        var directions = [];
        if (all_paths_indexes[j].length < 2) {
            shortest_path["points_on_route"] = [pointA, pointB];
            shortest_path["dist"] = [distanceBetweenTwoPoints(pointA, pointB)];
            shortest_path["directions"] = [getDirectionOfRoute(pointA, pointB)];
            return shortest_path;
        }
        var tmp_point = pointWherePathsAreConnected(all_paths[all_paths_indexes[j][0]], all_paths[all_paths_indexes[j][1]]);
        var tmp_pointsArray = [pointA, tmp_point];
        var tmp_distance = distanceBetweenTwoPoints(pointA, tmp_point);
        distances.push(tmp_distance)
        directions.push(getDirectionOfRoute(pointA, tmp_point))
        for (var i = 1; i < all_paths_indexes[j].length - 1; i++) {
            var dist = distanceBetweenTwoPoints(tmp_point, pointWherePathsAreConnected(all_paths[all_paths_indexes[j][i]], all_paths[all_paths_indexes[j][i + 1]]));
            tmp_distance += dist;
            distances.push(dist)
            directions.push(getDirectionOfRoute(tmp_point, pointWherePathsAreConnected(all_paths[all_paths_indexes[j][i]], all_paths[all_paths_indexes[j][i + 1]])))
            tmp_point = pointWherePathsAreConnected(all_paths[all_paths_indexes[j][i]], all_paths[all_paths_indexes[j][i + 1]]);
            tmp_pointsArray.push(tmp_point);
        }
        tmp_distance += distanceBetweenTwoPoints(tmp_point, pointB);
        distances.push(distanceBetweenTwoPoints(tmp_point, pointB))
        directions.push(getDirectionOfRoute(tmp_point, pointB))
        tmp_pointsArray.push(pointB)
        if (tmp_distance < distance_path) {
            distance_path = tmp_distance;
            shortest_path["points_on_route"] = tmp_pointsArray;
            shortest_path["dist"] = distances;
            shortest_path["directions"] = directions;
        }
    }
    return shortest_path;
}

// returns:
// top: 0; right: 1; bottom: 2; left: 3
function getDirectionOfRoute(from_point, to_point) {
    var x = to_point[0] - from_point[0]
    var y = to_point[1] - from_point[1]
    if (x != 0) {
        if (x > 0) {
            return 1;
        } else {
            return 3;
        }
    }
    if (y != 0) {
        if (y > 0) {
            return 2;
        } else {
            return 0;
        }
    }
}

function getAllPossiblePaths(connections, path_lines, destiny_path_index) {
    var all_routes_finsihed = true;
    for (var j in path_lines) {
        if (path_lines[j][path_lines[j].length - 1] != destiny_path_index) {
            all_routes_finsihed = false;
            var direct_con = getAllDirectConnections(connections, path_lines[j][path_lines[j].length - 1]);
            for (var i in direct_con) {
                if (path_lines[j].indexOf(direct_con[i]) > -1) {
                    // path will not be considered
                } else {
                    // path reached destination
                    var tmp = [];
                    for (var k in path_lines[j]) {
                        tmp.push(path_lines[j][k])
                    }
                    tmp.push((direct_con[i]));
                    path_lines.push(tmp)
                }
            }
            path_lines.splice(j, 1);
        }
    }
    if (all_routes_finsihed) {
        return path_lines;
    } else {
        return getAllPossiblePaths(connections, path_lines, destiny_path_index)
    }
}

function getAllDirectConnections(connections, path_index) {
    var paths = [];
    for (var i in connections) {
        if (connections[i][0] == path_index && paths.indexOf(connections[i][1]) < 0) {
            paths.push(connections[i][1]);
        } else if (connections[i][1] == path_index && paths.indexOf(connections[i][0]) < 0) {
            paths.push(connections[i][0]);
        }
    }
    return paths
}

function pathsInConnectedPathArray(pathA_index, pathB_index, connected_paths) {
    for (var i in connected_paths) {
        if (connected_paths[i].indexOf(Number(pathA_index)) > -1 &&
            connected_paths[i].indexOf(Number(pathB_index)) > -1) {
            return true;
        }
    }
    return false;
}

function getConectionArrayPaths(path_array) {
    var connected_paths = [];
    for (var i in path_array) {
        for (var j in path_array) {
            if (i != j && pointWherePathsAreConnected(path_array[i], path_array[j]) &&
                !pathsInConnectedPathArray(i, j, connected_paths)) {
                connected_paths.push([Number(i), Number(j)]);
            }
        }
    }
    return connected_paths;
}

function pointWherePathsAreConnected(pathA, pathB) {
    var inter = line_intersect(pathA.startPoint[0], pathA.startPoint[1], pathA.endPoint[0], pathA.endPoint[1],
        pathB.startPoint[0], pathB.startPoint[1], pathB.endPoint[0], pathB.endPoint[1]);
    if (inter)  {
        return [inter["x"], inter["y"]];
    } else {
        return null
    }
}


function line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    var ua, ub, denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom == 0) {
        return null;
    }
    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    if (ub < 0) return null;
    if (ua < 0) return null; // own modification: only consider points that are within the line (not like a vector)
    return {
        x: x1 + ua * (x2 - x1),
        y: y1 + ua * (y2 - y1),
        seg1: ua >= 0 && ua <= 1,
        seg2: ub >= 0 && ub <= 1
    };
}


function displayFullNavigation(level, shortest_path) {
    if (shortest_path["directions"].length == 0 && shortest_path["points_on_route"].length > 1) {
        var direction_of_desination = getDirectionOfRoute(shortest_path["points_on_route"][0], shortest_path["points_on_route"][1])
        shortest_path["points_on_route"] = shortest_path["points_on_route"].splice(1);
        displayDestinationReached(direction_of_desination)
    } else if (shortest_path["directions"].length > 0) {
        displayArrow(shortest_path["directions"][0], shortest_path["dist"][0]);
    }

    var points_on_route = shortest_path["points_on_route"];
    var ctx = document.getElementById('canvas').getContext('2d');
    var canvas = document.getElementById('canvas');
    if (!mapfullwidth) screen_width = screen_width * 4.5 / 10; // Desktop Version
    canvas.width = screen_width;
    canvas.height = screen_width;
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, screen_width, screen_width);
        if (from_room_object && etagen_nummer == from_room_object.level) {
            // draw circle at the current position of the user
            drawCircle(ctx, points_on_route[0][0] * canvas.width / 100, points_on_route[0][1] * canvas.height / 100, "rgba(255, 0, 0, 0.6)")
        }
        if (to_room_object && etagen_nummer == to_room_object.level) {
            // draw circle at the destination
            drawCircle(ctx, to_room_object.door_coordinates[0] * canvas.width / 100, to_room_object.door_coordinates[1] * canvas.height / 100, "rgba(34,139,34, 0.6)")
        }
        displayRouteBetweenPoints(ctx, points_on_route, canvas.width, canvas.height);
    };
    img.src = getImageURLForLevel(level);
}

function nextStepClicked() {

    if (shortest_nav_path["points_on_route"].length > shortest_nav_path["dist"].length + 2) {
        shortest_nav_path["dist"] = shortest_nav_path["dist"].splice(1)
        shortest_nav_path["directions"] = shortest_nav_path["directions"].splice(1)
        shortest_nav_path["points_on_route"] = shortest_nav_path["points_on_route"].splice(2)
    } else {
        shortest_nav_path["dist"] = shortest_nav_path["dist"].splice(1)
        shortest_nav_path["directions"] = shortest_nav_path["directions"].splice(1)
        shortest_nav_path["points_on_route"] = shortest_nav_path["points_on_route"].splice(1)
    }
    displayFullNavigation(etagen_nummer, shortest_nav_path)
}

function displayRouteBetweenPoints(ctx, full_path, imageWidth, imageHeigth) {
    ctx.beginPath();
    for (var i = 0; i < full_path.length - 1; i++) {
        ctx.moveTo(full_path[i][0] * imageWidth / 100, full_path[i][1] * imageHeigth / 100);
        ctx.lineTo(full_path[i + 1][0] * imageWidth / 100, full_path[i + 1][1] * imageHeigth / 100);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = "red";
    ctx.stroke();
}

function getDetailsOfNearestPath(point, path_array) {
    var min_distance = 100; // maximal possible distance in graph
    var min_point = null;
    var min_path = null;
    for (var i in path_array) {
        var tmp_point = getNearestPointOnPath(point, path_array[i]);
        var tmp_dist = distanceBetweenTwoPoints(point, tmp_point);
        if (tmp_dist < min_distance) {
            min_point = tmp_point;
            min_distance = tmp_dist;
            min_path = i;
        }
    }
    return {
        "point": min_point,
        "path_index": min_path,
        "distance": min_distance
    };
}

function cancelClicked() {
    if (to_room_object) {
        setToRoom(null);
    } else {
        setFromRoom(null);
    }
}

function storeRoomsOfBuilding() {
    var paths_data = {
        "EG": [{
            "start": ["5.40", "24.04"],
            "end": ["81.27", "24.04"],
            "color": "blue"
        }, {
            "start": ["81.27", "5.03"],
            "end": ["81.27", "87.35"],
            "color": "red"
        }, {
            "start": ["18.90", "94.69"],
            "end": ["18.90", "24.04"],
            "color": "pink"
        }, {
            "start": ["18.90", "51.39"],
            "end": ["81.27", "51.39"],
            "color": "yellow"
        }, {
            "start": ["63.74", "51.39"],
            "end": ["63.74", "87.35"],
            "color": "cyan"
        }],
        "1OG": [{
            "start": ["5.40", "24.04"],
            "end": ["81.27", "24.04"],
            "color": "blue"
        }, {
            "start": ["81.27", "5.14"],
            "end": ["81.27", "80.84"],
            "color": "red"
        }, {
            "start": ["94.69", "80.84"],
            "end": ["18.90", "80.84"],
            "color": "green"
        }, {
            "start": ["18.90", "94.69"],
            "end": ["18.90", "24.04"],
            "color": "pink"
        }, {
            "start": ["18.90", "51.39"],
            "end": ["81.27", "51.39"],
            "color": "yellow"
        }, {
            "start": ["54.01", "51.39"],
            "end": ["54.01", "80.84"],
            "color": "cyan"
        }]
    };
    for (var level in paths_data) {
        paths[level] = [];
        for (var i in paths_data[level]) {
            paths[level].push(new Paths(level, paths_data[level][i]));
        }
    }
    api("institutes", "all")
        //api("paths", "all")
}

function stringsAreEqual(str1, str2) {
    if (str1.localeCompare(str2) == 0) {
        return true;
    } else {
        return false;
    }
}

$(".etagen_btn").on("click", function() {
    etagen_nummer = Number(this.id.replace("etagen_btn", ""))
    if (from_room_object && to_room_object) {
        displayFullNavigation(etagen_nummer, shortest_nav_path);
    } else {
        setImageWithoutRoute(etagen_nummer, null)
    }
});

window.onscroll = function() { remainHeaderOnTop() };

var header = document.getElementById("myHeader");
var sticky = header.offsetTop;

function remainHeaderOnTop() {
    if (window.pageYOffset > sticky) {
        header.classList.add("sticky");
    } else {
        header.classList.remove("sticky");
    }
}

function setImageWithoutRoute(level, roomHighlighted) {
    var ctx = document.getElementById('canvas').getContext('2d');
    var canvas = document.getElementById('canvas');
    if (!mapfullwidth) screen_width = screen_width * 4.5 / 10; // Desktop Version
    canvas.width = screen_width;
    canvas.height = screen_width;
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, screen_width, screen_width);
        if (from_room_object && etagen_nummer == from_room_object.level) {
            // draw circle at the current position of the user
            drawCircle(ctx, from_room_object.door_coordinates[0] * canvas.width / 100, from_room_object.door_coordinates[1] * canvas.height / 100, "rgba(255, 0, 0, 0.6)")
        }
        if (to_room_object && etagen_nummer == to_room_object.level) {
            // draw circle at the destination
            drawCircle(ctx, to_room_object.door_coordinates[0] * canvas.width / 100, to_room_object.door_coordinates[1] * canvas.height / 100, "rgba(34,139,34, 0.6)")
        }
        if (roomHighlighted) {
            highLightRoom(ctx, roomHighlighted.spatial_extend, canvas.width, canvas.height)
        }
    };
    img.src = getImageURLForLevel(level);
}

function highLightRoom(ctx, spatial_extend, cvwidth, cvheight) {
    ctx.beginPath();
    ctx.rect(spatial_extend[0][0] * cvwidth / 100, spatial_extend[0][1] * cvheight / 100, (spatial_extend[1][0] - spatial_extend[0][0]) * cvwidth / 100, (spatial_extend[1][1] - spatial_extend[0][1]) * cvheight / 100);
    ctx.fillStyle = "rgba(124, 252, 0, 0.4)"; // green with transparence
    ctx.fill();
    ctx.stroke();
}

function drawCircle(ctx, centerX, centerY, color_string) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, 17, 0, 2 * Math.PI, false);
    ctx.fillStyle = color_string;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#003300';
    ctx.stroke();
}

var canvas = document.querySelector('canvas');
canvas.addEventListener('click', function(e) {
    if (to_room_object && from_room_object) {
        return;
    }
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = this;

    do {
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    }
    while (currentElement = currentElement.offsetParent)

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    var mouseX = (canvasX / this.width) * 100;
    var mouseY = (canvasY / this.height) * 100;
    for (var i in rooms_order_after_level[etagen_nummer]) {
        var room_obj = rooms_order_after_level[etagen_nummer][i];
        if (pointIsWithinSpatialExtend([mouseX, mouseY], room_obj.spatial_extend)) {
            setImageWithoutRoute(etagen_nummer, room_obj)
            $("#room_details").css("display", "block");
            if (from_room_object) {
                $("#room_details").html("<b>" + strings["room_nr"][language_index] + ":</b> " + room_obj.room_nr + "<span style='padding-left:25px'><btn class='btn btn-primary' onclick='setToRoom(" + room_obj.room_nr + ")' style='font-size:0.8em'>=> " + strings["navigate_to_room"][language_index] + "</btn></span><br>" +
                    "<b>" + strings["institute"][language_index] + ": </b>" + room_obj.institute.name + "")
            } else {
                $("#room_details").html("<b>" + strings["room_nr"][language_index] + ":</b> " + room_obj.room_nr + "<span style='padding-left:25px'><btn class='btn btn-primary' onclick='setFromRoom(" + room_obj.room_nr + ")' style='font-size:0.8em'>=> " + strings["start_from_here"][language_index] + "</btn></span><br>" +
                    "<b>" + strings["institute"][language_index] + ": </b>" + room_obj.institute.name + "")
            }
        }
    }
});

function pointIsWithinSpatialExtend(point, spatial_extend) {
    if (point[0] >= spatial_extend[0][0] && point[0] <= spatial_extend[1][0] &&
        point[1] >= spatial_extend[0][1] && point[1] <= spatial_extend[1][1]) {
        return true;
    } else {
        return false;
    }
}

function getImageURLForLevel(level) {
    var img_name = "EG.png"; // default value
    switch (level) {
        case "1":
        case 1:
            img_name = "KG.png";
            break;
        case "2":
        case 2:
            img_name = "EG.png";
            break;
        case "3":
        case 3:
            img_name = "1OG.png";
            break;
        case "4":
        case 4:
            img_name = "2OG.png";
            break;
        case "5":
        case 5:
            img_name = "3OG.png";
            break;
        case "6":
        case 6:
            img_name = "4OG.png";
            break;
        case "7":
        case 7:
            img_name = "5OG.png";
            break;
        default:
            break;
    }
    return to_floor_plans_folder + img_name;

}

function setToRoom(to_room_number) {
    var current_loc = window.location + "";
    var end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    if (from_room) {
        end_loc += "&" + from_room_param_str + "=" + from_room;
    }
    if (to_room_number) {
        end_loc += "&" + to_room_param_str + "=" + to_room_number;
    }
    window.location = end_loc;
}

function setFromRoom(from_room_number) {
    var current_loc = window.location + "";
    var end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    if (to_room) {
        end_loc += "&" + to_room_param_str + "=" + to_room;
    }
    if (from_room_number) {
        end_loc += "&" + from_room_param_str + "=" + from_room_number;
    }
    window.location = end_loc;
}


function autocomplete(inp, arr) {
    /* source: https://www.w3schools.com/howto/howto_js_autocomplete.asp
    the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return false; }
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            //here
            if (oneOfWordsStartsWith(arr[i], val)) {
                /*create a DIV element for each matching element:*/
                b = document.createElement("DIV");
                /*make the matching letters bold:*/
                b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
                b.innerHTML += arr[i].substr(val.length);
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                    /*insert the value for the autocomplete text field:*/
                    inp.value = this.getElementsByTagName("input")[0].value;
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    closeAllLists();
                    setToRoom(inp.value.substr(0, inp.value.indexOf("-")).replace(" ", ""));
                });
                a.appendChild(b);
            }
        }
    });
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
            /*If the arrow DOWN key is pressed,
            increase the currentFocus variable:*/
            currentFocus++;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 38) { //up
            /*If the arrow UP key is pressed,
            decrease the currentFocus variable:*/
            currentFocus--;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 13) {
            /*If the ENTER key is pressed, prevent the form from being submitted,*/
            e.preventDefault();
            if (currentFocus > -1) {
                /*and simulate a click on the "active" item:*/
                if (x) x[currentFocus].click();
            }
        }
    });

    function addActive(x) {
        /*a function to classify an item as "active":*/
        if (!x) return false;
        /*start by removing the "active" class on all items:*/
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        /*add class "autocomplete-active":*/
        x[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(x) {
        /*a function to remove the "active" class from all autocomplete items:*/
        for (var i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function(e) {
        closeAllLists(e.target);
    });
}

function oneOfWordsStartsWith(autocomplete_string, starting_string) {
    starting_string = starting_string.trim();
    var search_for = starting_string.split(" ");
    var words = autocomplete_string.split(/-| /);
    var count = 0;
    for (var j in search_for) {
        for (var i in words) {
            //words[i] = words[i].replace(" ", "");
            if (words[i].substr(0, search_for[j].length).toUpperCase() == search_for[j].toUpperCase()) {
                count++;
            }
        }
    }
    if (count == search_for.length) return true;
    return false;
}