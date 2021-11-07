

const baseUrl = "https://cors-anywhere.herokuapp.com/"

var inputurl = "https://apnews.com";

var prev = inputurl;

var data = "";
var dataArray = [];

const removals = ["http", "@", ".com", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "#", "\n"]

var sort = 3;

var historyRef = firebase.database().ref("history");

historyRef.on("value", function (snapshot) {
  let errorArray = [];
  let histArray = [];
  window.nhistory = snapshot.val();
  Object.keys(nhistory).forEach((item) => {
    histArray.push(nhistory[item].url)
    errorArray.push(nhistory[item].error)
  })
  for (i = 0; i < histArray.length; i++){
    let item = histArray[i];
    item = item.replace(/^https:\/\//i, "");
    item = item.replace(/www./i, "");
    item = item.split("/")
    histArray[i] = item[0]
  }
  histArray = [...new Set(histArray)];
  let hist2 = []
  histArray.forEach((item) => {hist2.push(["url",item])})
  document.getElementById("dataset-base").innerHTML = renderTable(hist2,undefined,false);
  graph(errorArray);
});


var mainref = firebase.database().ref("neurons");

mainref.on("value", function (snapshot) {
  window.neurons = snapshot.val();
  document.getElementById("neurons").innerText = "Neurons: " + Object.keys(neurons).length
  getData();
});



var showNeurons = false;
var showDetail = false;

var firelist = [];

var right = 0;
var left = 0;
var fired = 0;
var bias = "none";


async function getData() {
  data = "";
  let response = await fetch(baseUrl + inputurl);
  let responseText = await response.text();
  data = (htmlToText(responseText));
  document.getElementById("frame").src = inputurl;
  prepareData();
  document.getElementById("data").innerText = dataArray.toString().replace(/,/g, " ");
};

function onChange() {
  inputurl = document.getElementById("url").value;
  getData();
}

function prepareData() {
  data = data.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
  let dataB = [];
  dataB = data.split(" ");
  let length = removals.length
  dataB.forEach((word, index) => {
    let rindex = 0;
    let toDelete = false;
    while (toDelete === false && rindex < length) {
      if (word.includes(removals[rindex])) {
        delete dataB[index]
        toDelete = true;
      }
      else {
        if (word === "\n" || word === '') {
          delete dataB[index]
          toDelete = true;
        }
      }
      rindex++;
    }
  })
  dataArray = dataB.flat()
  recognize();
}

function recognize() {
  let leftTriggers = []
  let rightTriggers = []
  firelist = [];
  left = 0;
  right = 0;
  fired = 0
  bias = "none"
  let neuronKeys = Object.keys(neurons)
  dataArray.forEach((input) => {
    if (neuronKeys.includes(input)) {
      let myLeft = neurons[input].left
      let myRight = neurons[input].right
      left += myLeft
      right += myRight
      let dif = Math.abs(myRight - myLeft)
      fired += 1;
      if (myLeft > myRight && dif > 10) { leftTriggers.push(input) } else { if (myRight > myLeft && dif > 10) { rightTriggers.push(input) } }
      firelist.push(input)
    }
  })
  firelist = [...new Set(firelist)];
  if (right > left) {
    bias = "right"
  }
  else {
    if (left >= right) {
      bias = "left"
    }
  }
  let uniqueLT = [...new Set(leftTriggers)];
  let uniqueRT = [...new Set(rightTriggers)];
  document.getElementById("neurons").innerText = "Neurons: " + neuronKeys.length
  document.getElementById("left").innerText = "Left: " + left
  document.getElementById("right").innerText = "Right: " + right
  document.getElementById("fcount").innerText = "Firing Count: " + fired
  document.getElementById("rightTriggers").innerText = uniqueRT.join(', ');
  document.getElementById("leftTriggers").innerText = uniqueLT.join(', ');

  rAbs = Math.abs(right);
  lAbs = Math.abs(left);
  let max = (rAbs >= lAbs)? rAbs: lAbs
  let min = (rAbs <= lAbs)? rAbs: lAbs
  if ((right > 0 && left > 0) || (left < 0 && right < 0)){min = Math.abs(left - right)}
  let percent = min / max
  
  if (percent > 1) { percent = 1 }
  
  let biasText = "Bias: " + bias + " " + (percent * 100).toFixed() + "%"

  document.getElementById("bias").innerText = biasText
  document.getElementById("bias-2").innerText = biasText
  console.log(percent)
  gaugedata[0].value = percent * 100;
  let xStart = 175;
  if (bias === "right") { xStart = xStart + (170 * percent) } else { xStart = xStart - (170 * percent) }
  //Plotly.redraw("myDiv")
  drawRect("black", xStart, 5, 5, 95)
}

function prune() {
  for (i = 0; i < 20; i++) {
    let minUseless = [10000000000000, ""]
    Object.keys(neurons).forEach((neuron) => {
      let myRight = neurons[neuron].right
      let myLeft = neurons[neuron].left
      let myAge = neurons[neuron].age
      let myDif = Math.abs(myRight - myLeft);
      let myUsefullness = myAge * myDif
      if (myUsefullness < minUseless[0]) {
        minUseless[0] = myUsefullness;
        minUseless[1] = neuron;
      }
    })
    delete neurons[minUseless[1]];
  }
}

function learn(reinforcement) {
  deleted = 0;
  if (reinforcement) {
    firelist.forEach((firedNeuron) => {
      neurons[firedNeuron].age += 1
      let myLeft = neurons[firedNeuron].left;
      let myRight = neurons[firedNeuron].right

      let myVote = (myRight > myLeft) ? "right" : "left";
      if (myRight === myLeft) { myVote = "none" }
      myCombo = bias + myVote;

      switch (myCombo) {
        case "leftleft":
          neurons[firedNeuron].left += 1;
          break;
        case "leftright":
          neurons[firedNeuron].right -= 1;
          break;
        case "leftnone":
          neurons[firedNeuron].right += randomSign();
          neurons[firedNeuron].left += randomSign();
          break;
        case "rightright":
          neurons[firedNeuron].right += 1;
          break;
        case "rightleft":
          neurons[firedNeuron].left -= 1;
          break;
        case "rightnone":
          neurons[firedNeuron].right += randomSign();
          neurons[firedNeuron].left += randomSign();
          break;
        default:
          break;
      }
      if (Math.abs(myLeft > 30)){neurons[firedNeuron].left = (myLeft < 0)?-30:30}
      if (Math.abs(myRight > 30)){neurons[firedNeuron].right = (myRight < 0)?-30:30}
    })
  }
  else {
    firelist.forEach((firedNeuron) => {
      neurons[firedNeuron].age += 1
      let myRight = neurons[firedNeuron].right;
      let myLeft = neurons[firedNeuron].left;
      let myVote = (myRight > myLeft) ? "right" : "left";
      if (myRight === myLeft) { myVote = "none" }
      myCombo = bias + myVote;

      switch (myCombo) {
        case "leftleft":
          neurons[firedNeuron].left -= 1;
          break;
        case "leftright":
          neurons[firedNeuron].right += 1;
          break;
        case "leftnone":
          neurons[firedNeuron].right += randomSign();
          neurons[firedNeuron].left += randomSign();
          break;
        case "rightright":
          neurons[firedNeuron].right -= 1;
          break;
        case "rightleft":
          neurons[firedNeuron].left += 1;
          break;
        case "rightnone":
          neurons[firedNeuron].right += randomSign();
          neurons[firedNeuron].left += randomSign();
          break;
        default:
          break;
      }
      if (Math.abs(myLeft > 30)){neurons[firedNeuron].left = (myLeft < 0)?-30:30}
      if (Math.abs(myRight > 30)){neurons[firedNeuron].right = (myRight < 0)?-30:30}
    })
  }

  if (Object.keys(neurons).length >= 5000) { prune() }

  dataArray.forEach((word) => {
    if (neurons[word] === undefined && Object.keys(neurons).length < 5000) {
      let sign = 1;
      if (!reinforcement){sign = -1}
      neurons[word] = {
        left: (bias === "left") ? sign : 0,
        right: (bias === "right") ? sign : 0,
        age: 1
      }
    }
  })
 
  firebase.database().ref("neurons").set(neurons);

  firebase.database().ref("history").push({
    date: Date.now(),
    url: inputurl,
    bias: bias,
    error: !reinforcement
  });

}

function randomSign() {
  let signs = [1, -1]
  let randomIndex = Math.floor(Math.random() * 2);
  return signs[randomIndex]
}

function inspect() {
  showNeurons = !showNeurons
  if (showNeurons) {
    let neurondata = [];
    Object.keys(neurons).forEach(neuron => {
      neurondata.push([neuron, neurons[neuron].right, neurons[neuron].left, neurons[neuron].age])
    })
    document.getElementById("neuron-table").innerHTML = renderTable(neurondata.sort((a, b) => sortFunction(a, b)))
    document.getElementById("inspect").innerHTML = '<p>Hide Neurons</p>'
  }
  else {
    document.getElementById("neuron-table").innerHTML = null;
    document.getElementById("inspect").innerHTML = '<p>Inspect Neural Net</p>'
  }
}

function show() {
  showDetail = !showDetail
  if (showDetail) {

    document.getElementById("detail-div").style.display = "block"
    document.getElementById("details").innerHTML = '<p>Hide Details</p>'
  }
  else {
    document.getElementById("detail-div").style.display = "none"
    document.getElementById("details").innerHTML = '<p>Show Details</p>'
  }
}
var showHist = false;
function showHistory() {
  showHist = !showHist
  if (showHist) {

    document.getElementById("dataset-base").style.display = "block"
    document.getElementById("dataset-btn").innerHTML = '<p>Hide Training History</p>'
  }
  else {
    document.getElementById("dataset-base").style.display = "none"
    document.getElementById("dataset-btn").innerHTML = '<p>Show Training History</p>'
  }
}

function sortFunction(a, b) {
  if (a[sort] === b[sort]) {
    return 0;
  }
  return (a[sort] < b[sort]) ? 1 : -1;
}

function sorton() {
  let newsorttype = document.getElementById("sorton").value;
  switch (newsorttype) {
    case "neuron": sort = 0;
      break;
    case "right": sort = 1;
      break;
    case "left": sort = 2;
      break;
    case "age": sort = 3;
      break;
    default:
      break;
  }
  let neurondata = [];
  Object.keys(neurons).forEach(neuron => {
    neurondata.push([neuron, neurons[neuron].right, neurons[neuron].left, neurons[neuron].age])
  })
  document.getElementById("neuron-table").innerHTML = renderTable(neurondata.sort((a, b) => sortFunction(a, b)))
}

function renderTable(data = [], props = "",sort = true) {

  selecthtml = '<select onchange="sorton()" name="sorton" id="sorton"><option value="none" selected>Sort On:</option><option value="neuron">Neuron</option><option value="right">Right</option><option value="left">Left</option><option value="age">Age</option></select>'
  let rows = data.length;
  let columns = data[0].length;
  if(sort === false){selecthtml = ""}
  let head = '<thead><th>Neuron</th><th>Weight Right</th><th>Weight Left</th><th>Age</th></thead>'
  if (sort === false){head = ""}

  let table = selecthtml + "<table " + props + '>' + head + '<tbody>';

  for (var r = 0; r < rows; r++) {
    table += "<tr>";
    for (var c = 0; c < columns; c++) {
      table += ('<td class="' + c + '" style="border: 1px solid #000;">' + data[r][c] + "</td>");
    }
    table += "</tr>";
  }
  table += "</tbody></table>";
  return table;
}

var gaugedata = [

  {
    type: "indicator",
    mode: "gauge",
    value: 0,
    title: { text: "Bias", font: { size: 24 } },
    delta: { reference: 400, increasing: { color: "RebeccaPurple" } },
    gauge: {
      axis: { range: [null, 100], tickwidth: 1, tickcolor: "darkblue" },
      bar: { color: "white" },
      bgcolor: "white",
      borderwidth: 2,
      bordercolor: "gray",
      steps: [
        { range: [0, 50], color: "blue" },
        { range: [50, 100], color: "red" }
      ]
    }
  }
];
var layout = {
  width: 500,
  height: 400,
  margin: { t: 25, r: 25, l: 25, b: 25 },
  paper_bgcolor: "white",
  font: { color: "darkblue", family: "Arial" }
};


//Plotly.newPlot('myDiv', gaugedata, layout);

function clearNetwork() {
  Object.keys(neurons).forEach((neuron) => {
    delete neurons[neuron]
  });

  neurons["the"] = {
    left: -1,
    right: 1,
    age: 1
  }

  let history = {};
  firebase.database().ref("history").set(history)
  firebase.database().ref("neurons").set(neurons)
  recognize();
}

function drawRect(color, X, Y, Xend, Yend) {
  let canvas = document.getElementById('my-canvas');
  var background = new Image();
  background.src = "scale.jpg";
  background.onload = function () {
    canvas.imageSmoothingQuality = "high"
    let context = canvas.getContext('2d');
    context.clearRect(0, 0, 200, 200);
    context.drawImage(background, 0, 0, background.width, background.height, 0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.fillStyle = color;
    context.fillRect(X, Y, Xend, Yend);
    context.fill();
  }
}

function graph(stats){
  let canvas = document.getElementById('graph');
  canvas.imageSmoothingQuality = "low"
  let ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  
  let xstep = canvas.width / stats.length
  
  let x = xstep;
  let y = canvas.height;
  ctx.moveTo(0, y);
  ctx.lineTo(canvas.width,0)
  ctx.lineWidth = 1;
  ctx.strokeStyle = "red"
  ctx.stroke();
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.strokeStyle = "black"
  let sum = 0;
  stats.forEach((stat)=>{sum+=stat?1:0})
 let ystep = canvas.height / (sum )
  stats.forEach((stat) => {
    y-=stat?ystep:0
    ctx.lineTo(x,y)
    x += xstep;
  })
  ctx.lineWidth = 2;
  
  ctx.stroke();
  let end = stats.length;
  let start = end - 20;
  let newArray = []
  for(i= start; i < end; i++){
    newArray.push(stats[i])
  }
  let total = 0;
  newArray.forEach((item) => {total += item?0:1})
  let percent = 100 *  (total / newArray.length) + '%';
  document.getElementById("accuracy").innerText = percent;
  alert(total)
}


