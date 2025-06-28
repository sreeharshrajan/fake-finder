App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    // TODO: refactor conditional
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = web3.currentProvider;
      ethereum.enable(); 
      web3 = new Web3(web3.currentProvider);
    } else {
      // Specify default instance if no web3 instance provided
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Election.json", function(election) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.Election = TruffleContract(election);
      // Connect provider to interact with contract
      App.contracts.Election.setProvider(App.web3Provider);

      App.listenForEvents();

      return App.render();
    });
  },

  // Listen for events emitted from the contract
  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      // Restart Chrome if you are unable to receive this event
      // This is a known issue with Metamask
      // https://github.com/MetaMask/metamask-extension/issues/2393
      instance.votedEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("event triggered", event)
        // Reload when a new vote is recorded
        App.render();
      });
    });
  },

  render: function() {
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Load account data
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("<h3>Account Information </h3>" + account);
      }
    });


    // Load contract data
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      var candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();

      for (var i = 1; i <= candidatesCount; i++) {
        electionInstance.candidates(i).then(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var voteCount = candidate[2];

          // Render candidate Result
          var candidateTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>" + voteCount + "</td></tr>"
          candidatesResults.append(candidateTemplate);

          // Render candidate ballot option
          var candidateOption = "<option value='" + id + "' >" + name + "</ option>"
          candidatesSelect.append(candidateOption);
        });
      }
      return electionInstance.voters(App.account);
    }).then(function(hasVoted) {
      // Do not allow a user to vote
      if(hasVoted) {
        $('form').hide();
      }
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  castVote: function() {
    var candidateId = $('#candidatesSelect').val();
    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      // Wait for votes to update
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    });
  }
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});

/*Buy Tokens*/
window.buyTokens = function() {
	let tokensToBuy = $("#buy").val();
	let price = tokensToBuy * tokenPrice;
	$("#buy-msg").html("Purchase order has been submitted. Please wait.");
	Voting.deployed().then(function(contractInstance) {
		contractInstance.buy({value: web3.toWei(price, 'ether'), from: web3.eth.accounts[2]}).then(function(v) {
			$("#buy-msg").html("");
			web3.eth.getBalance(contractInstance.address, function(error, result) {
				$("#contract-balance").html(web3.fromWei(result.toString()) + " Ether");
			});
		})
	});
	populateTokenData();
}

window.lookupVoterInfo = function() {
	let address = $("#voter-info").val();
	Voting.deployed().then(function(contractInstance) {
		contractInstance.voterDetails.call(address).then(function(v) {
			$("#tokens-bought").html("Total Tokens bought: " + v[0].toString());
			let votesPerCandidate = v[1];
			$("#votes-cast").empty();
			$("#votes-cast").append("Votes cast per candidate: <br>");
			let allCandidates = Object.keys(candidates);
			for(let i=0; i < allCandidates.length; i++) {
				$("#votes-cast").append(allCandidates[i] + ": " + votesPerCandidate[i] + "<br>");
			}
		});
	});
}

/*Fetch Tokens*/
function populateTokenData() {
	Voting.deployed().then(function(contractInstance) {
		contractInstance.totalTokens().then(function(v) {
			$("#tokens-total").html(v.toString());
		});
		contractInstance.tokensSold.call().then(function(v) {
			$("#tokens-sold").html(v.toString());
		});
		contractInstance.tokenPrice().then(function(v) {
			tokenPrice = parseFloat(web3.fromWei(v.toString()));
			$("#token-cost").html(tokenPrice + " Ether");
		});
		web3.eth.getBalance(contractInstance.address, function(error, result) {
			$("#contract-balance").html(web3.fromWei(result.toString()) + " Ether");
		});
	});
}

$( document ).ready(function() {
	if (typeof web3 !== 'undefined') {
		console.warn("Using web3 detected from external source like Metamask")
		// Use Mist/MetaMask's provider
		window.web3 = new Web3(web3.currentProvider);
	} else {
		console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
		// fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
		window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
	}

	Voting.setProvider(web3.currentProvider);
	populateCandidates();

});